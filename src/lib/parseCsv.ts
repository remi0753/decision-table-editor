import { type Logic } from '@/types/logic';
import { type BatchCase } from '@/types/batch';

// RFC 4180 compliant CSV parser with BOM removal
export function parseCsvText(text: string): string[][] {
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < cleaned.length) {
    const ch = cleaned[i];

    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        current.push(field);
        field = '';
        i++;
      } else if (ch === '\r' && cleaned[i + 1] === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i += 2;
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  current.push(field);
  if (current.some(f => f !== '')) rows.push(current);

  return rows;
}

type ColRole =
  | { type: 'name' }
  | { type: 'input'; fieldId: string }
  | { type: 'expected'; outputColId: string }
  | { type: 'unknown' };

export function parseBatchCsv(
  text: string,
  logic: Logic,
): { cases: BatchCase[]; warnings: string[] } {
  const rows = parseCsvText(text);

  if (rows.length < 1 || rows[0]!.every(h => h === '')) {
    return { cases: [], warnings: ['ヘッダー行が空です。テンプレートをダウンロードして作成してください。'] };
  }

  const headers = rows[0]!;

  const fieldsByName: Record<string, string> = {};
  for (const [id, field] of Object.entries(logic.fieldDefs)) {
    fieldsByName[field.name] = id;
  }

  const outputColsByName: Record<string, string> = {};
  for (const table of Object.values(logic.tables)) {
    for (const oc of table.outputCols) {
      if (!(oc.name in outputColsByName)) {
        outputColsByName[oc.name] = oc.id;
      }
    }
  }

  const colRoles: ColRole[] = headers.map(h => {
    const trimmed = h.trim();
    if (trimmed === 'ケース名') return { type: 'name' } satisfies ColRole;
    const fieldId = fieldsByName[trimmed];
    if (fieldId) return { type: 'input', fieldId } satisfies ColRole;
    if (trimmed.startsWith('期待:')) {
      const colName = trimmed.slice(3);
      const outputColId = outputColsByName[colName];
      if (outputColId) return { type: 'expected', outputColId } satisfies ColRole;
    }
    return { type: 'unknown' } satisfies ColRole;
  });

  const warnings: string[] = [];
  const hasInputCols = colRoles.some(r => r.type === 'input');
  if (!hasInputCols) {
    warnings.push(
      '入力値の列が見つかりませんでした。ヘッダーのフィールド名がロジックのフィールド名と一致しているか確認してください。',
    );
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    return { cases: [], warnings: ['テストケースが1件もありません。データ行を追加してください。'] };
  }

  let autoIndex = 1;
  const cases: BatchCase[] = dataRows.map(row => {
    const inputs: Record<string, string> = {};
    const expected: Record<string, string> = {};
    let name = '';

    colRoles.forEach((role, i) => {
      const value = (row[i] ?? '').trim();
      if (role.type === 'name') {
        name = value;
      } else if (role.type === 'input' && value !== '') {
        inputs[role.fieldId] = value;
      } else if (role.type === 'expected' && value !== '') {
        expected[role.outputColId] = value;
      }
    });

    if (!name) {
      name = `ケース${autoIndex}`;
      autoIndex++;
    }

    return { name, inputs, expected };
  });

  return { cases, warnings };
}
