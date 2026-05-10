import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { type Conclusion, type Table } from '@/types/logic';
import { useLogicStore } from '@/store/logicStore';
import { canReference } from '@/engine/checks';
import { cn } from '@/lib/utils';

interface Props {
  tableId: string;
  rowId: string;
  conclusion: Conclusion;
  outputCols: Table['outputCols'];
}

export function ConclusionCell({ tableId, rowId, conclusion, outputCols }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'terminal' | 'continue'>(conclusion.type);
  const [outputs, setOutputs] = useState<Record<string, string>>(
    conclusion.type === 'terminal' ? conclusion.outputs : {}
  );
  const [targetTableId, setTargetTableId] = useState<string>(
    conclusion.type === 'continue' ? conclusion.tableId : ''
  );

  const logic = useLogicStore(s => s.logic);
  const setConclusion = useLogicStore(s => s.setConclusion);

  const tables = Object.values(logic.tables).filter(t => t.id !== tableId);

  const handleOpen = (o: boolean) => {
    if (o) {
      setType(conclusion.type);
      setOutputs(conclusion.type === 'terminal' ? { ...conclusion.outputs } : {});
      setTargetTableId(conclusion.type === 'continue' ? conclusion.tableId : '');
    }
    setOpen(o);
  };

  const handleSave = () => {
    if (type === 'terminal') {
      setConclusion(tableId, rowId, { type: 'terminal', outputs });
    } else {
      if (!targetTableId) return;
      setConclusion(tableId, rowId, { type: 'continue', tableId: targetTableId });
    }
    setOpen(false);
  };

  const summaryText = () => {
    if (conclusion.type === 'terminal') {
      const entries = Object.entries(conclusion.outputs);
      if (entries.length === 0) return '（出力未設定）';
      return entries.map(([id, v]) => {
        const col = outputCols.find(oc => oc.id === id);
        return `${col?.name ?? id}: ${v}`;
      }).join(' / ');
    }
    const t = logic.tables[conclusion.tableId];
    return `→ ${t?.name ?? conclusion.tableId}`;
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpen}>
      <Popover.Trigger asChild>
        <button className={cn(
          'w-full h-full px-2 py-1 text-left text-xs hover:bg-gray-50 transition-colors',
          conclusion.type === 'continue' ? 'text-purple-700' : 'text-gray-700',
        )}>
          {summaryText()}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="bg-white border rounded-lg shadow-lg p-4 w-80 z-50" sideOffset={4}>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-1 cursor-pointer text-sm">
                <input type="radio" checked={type === 'terminal'} onChange={() => setType('terminal')} />
                終端結論
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-sm">
                <input type="radio" checked={type === 'continue'} onChange={() => setType('continue')} />
                継続参照
              </label>
            </div>

            {type === 'terminal' && (
              <div className="space-y-2">
                {outputCols.map(oc => (
                  <div key={oc.id}>
                    <label className="text-xs text-gray-500 block mb-0.5">{oc.name}</label>
                    <input
                      value={outputs[oc.id] ?? ''}
                      onChange={e => setOutputs(p => ({ ...p, [oc.id]: e.target.value }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="出力値"
                    />
                  </div>
                ))}
              </div>
            )}

            {type === 'continue' && (
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">参照先テーブル</label>
                <select
                  value={targetTableId}
                  onChange={e => setTargetTableId(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">選択してください</option>
                  {tables.map(t => {
                    const allowed = canReference(tableId, t.id, logic.tables);
                    return (
                      <option key={t.id} value={t.id} disabled={!allowed}>
                        {t.name}{!allowed ? '（循環参照）' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={type === 'continue' && !targetTableId}
              className="w-full bg-blue-600 text-white text-xs rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
            >
              設定
            </button>
          </div>
          <Popover.Arrow className="fill-white stroke-gray-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
