import { toast } from 'sonner';
import { type Logic } from '@/types/logic';
import { LogicSchema } from '@/lib/schema';
import { useLogicStore } from '@/store/logicStore';

function getAllColIds(logic: Logic): string[] {
  return Object.values(logic.tables).flatMap(t => t.cols.map(c => c.id));
}

function getAllOColIds(logic: Logic): string[] {
  return Object.values(logic.tables).flatMap(t => t.outputCols.map(oc => oc.id));
}

function getAllRowIds(logic: Logic): string[] {
  return Object.values(logic.tables).flatMap(t => t.rows.map(r => r.id));
}

function maxId(prefix: string, ids: string[]): number {
  const nums = ids
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.slice(prefix.length)))
    .filter(n => !isNaN(n));
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function repairLogic(logic: Logic): { logic: Logic; messages: string[] } {
  const messages: string[] = [];

  for (const table of Object.values(logic.tables)) {
    for (const row of table.rows) {
      if (row.conclusion.type === 'continue' && !logic.tables[row.conclusion.tableId]) {
        row.conclusion = { type: 'terminal', outputs: {} };
        messages.push('参照先が見つからない継続参照をリセットしました。');
      }
    }
  }

  const maxOColNum = Math.max(0, ...getAllOColIds(logic).map(id => parseInt(id.slice(2))).filter(n => !isNaN(n)));
  let nextOCol = maxOColNum + 1;
  for (const table of Object.values(logic.tables)) {
    if (table.outputCols.length === 0) {
      table.outputCols.push({ id: `oc${nextOCol}`, name: '結果' });
      nextOCol++;
      messages.push('出力列が未定義のテーブルに「結果」列を追加しました。');
    }
  }

  logic.nField = maxId('f', Object.keys(logic.fieldDefs)) + 1;
  logic.nTable = maxId('t', Object.keys(logic.tables)) + 1;
  logic.nCol   = maxId('c', getAllColIds(logic)) + 1;
  logic.nOCol  = maxId('oc', getAllOColIds(logic)) + 1;
  logic.nRow   = maxId('r', getAllRowIds(logic)) + 1;

  return { logic, messages };
}

export function exportLogic(logic: Logic): void {
  const safeName = logic.name.replace(/[/\\?%*:|"<>]/g, '_') || 'logic';
  const blob = new Blob([JSON.stringify(logic, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function useImportLogic() {
  const importLogic = useLogicStore(s => s.importLogic);

  return () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = LogicSchema.safeParse(parsed);
        if (!result.success) {
          toast.error('JSONの形式が正しくありません。' + result.error.issues[0]?.message);
          return;
        }
        const { logic: repaired, messages } = repairLogic(result.data as Logic);
        importLogic(repaired);
        if (messages.length > 0) {
          toast.warning('インポート時に自動修復を行いました: ' + messages.join(' / '));
        } else {
          toast.success('インポートしました。');
        }
      } catch {
        toast.error('JSONのパースに失敗しました。');
      }
    };
    input.click();
  };
}
