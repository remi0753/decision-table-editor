import { cmp, coerce, today } from './coerce.js';
import type {
  Cell,
  Col,
  EvalResult,
  Logic,
  Row,
  TraceStep,
} from './types/logic.js';

const MAX_DEPTH = 50;

function cellMatches(
  cell: Cell,
  inputVal: string | undefined,
  fieldType: string,
): boolean {
  const { op, val } = cell;
  const a = coerce(inputVal ?? null, fieldType as Parameters<typeof coerce>[1]);

  if (op === 'null') return a === null;
  if (a === null) return false;

  if (op === 'between' && Array.isArray(val)) {
    const lo = coerce(
      val[0] ?? null,
      fieldType as Parameters<typeof coerce>[1],
    );
    const hi = coerce(
      val[1] ?? null,
      fieldType as Parameters<typeof coerce>[1],
    );
    if (lo === null || hi === null) return false;
    if ((cmp(lo) as number) > (cmp(hi) as number)) return false;
    return (
      (cmp(lo) as number) <= (cmp(a) as number) &&
      (cmp(a) as number) <= (cmp(hi) as number)
    );
  }

  if (op === 'in' && Array.isArray(val)) {
    const bs = val
      .map((v) => coerce(v, fieldType as Parameters<typeof coerce>[1]))
      .filter((b) => b !== null);
    if (bs.length === 0) return false;
    return bs.some((b) => cmp(a) === cmp(b));
  }

  if (op === 'before_today')
    return (cmp(a) as number) < (cmp(today()) as number);
  if (op === 'today_or_before')
    return (cmp(a) as number) <= (cmp(today()) as number);
  if (op === 'after_today')
    return (cmp(a) as number) > (cmp(today()) as number);
  if (op === 'today_or_after')
    return (cmp(a) as number) >= (cmp(today()) as number);

  const b = coerce(
    typeof val === 'string' ? val : null,
    fieldType as Parameters<typeof coerce>[1],
  );
  if (b === null) return false;

  const ca = cmp(a),
    cb = cmp(b);
  switch (op) {
    case '=':
      return ca === cb;
    case '!=':
      return ca !== cb;
    case '<':
      return (ca as number) < (cb as number);
    case '<=':
      return (ca as number) <= (cb as number);
    case '>':
      return (ca as number) > (cb as number);
    case '>=':
      return (ca as number) >= (cb as number);
    case 'contains':
      return String(a).includes(String(b));
    case 'starts_with':
      return String(a).startsWith(String(b));
    case 'ends_with':
      return String(a).endsWith(String(b));
    default:
      return false;
  }
}

function rowMatches(
  row: Row,
  cols: Col[],
  inputs: Record<string, string>,
  fieldDefs: Logic['fieldDefs'],
): { matched: boolean; failedColId: string | null } {
  for (const col of cols) {
    const cell = row.cells[col.id];
    if (!cell) continue;
    if (!col.fieldId) continue;
    const field = fieldDefs[col.fieldId];
    if (!field) continue;
    const inputVal = inputs[col.fieldId];
    if (!cellMatches(cell, inputVal, field.type)) {
      return { matched: false, failedColId: col.id };
    }
  }
  return { matched: true, failedColId: null };
}

/**
 * Normalise input keys so that callers may pass either fieldId-keyed inputs
 * (the engine's native contract) or field-name-keyed inputs (what
 * `@leverie/schema` advertises to LLMs / MCP clients).
 *
 * Any key that matches a known fieldId is kept as-is. Any remaining key that
 * matches a fieldDef name is remapped to that field's id. Keys that match
 * neither are dropped — they would have produced `undefined` lookups anyway,
 * but eagerly dropping them keeps `rowMatches`' input shape clean.
 *
 * When a fieldId-keyed entry already exists, it takes precedence over a
 * collision from a name-keyed entry pointing at the same id.
 */
function normaliseInputKeys(
  inputs: Record<string, string>,
  fieldDefs: Logic['fieldDefs'],
): Record<string, string> {
  const result: Record<string, string> = {};
  const nameToId = new Map<string, string>();
  for (const [id, field] of Object.entries(fieldDefs)) {
    nameToId.set(field.name, id);
  }

  for (const [key, value] of Object.entries(inputs)) {
    if (key in fieldDefs) {
      result[key] = value;
    }
  }
  for (const [key, value] of Object.entries(inputs)) {
    if (key in fieldDefs) continue;
    const id = nameToId.get(key);
    if (id && !(id in result)) {
      result[id] = value;
    }
  }
  return result;
}

export function evaluateTable(
  tableId: string,
  inputs: Record<string, string>,
  logic: Logic,
  previousTrace: TraceStep[] = [],
  depth = 0,
): EvalResult {
  if (depth > MAX_DEPTH) {
    return { status: 'no_match', tableId, trace: previousTrace };
  }

  const table = logic.tables[tableId];
  if (!table) return { status: 'no_match', tableId, trace: previousTrace };

  const normalisedInputs =
    depth === 0 ? normaliseInputKeys(inputs, logic.fieldDefs) : inputs;

  const stepTrace: TraceStep = {
    tableId,
    tableName: table.name,
    depth,
    matchedRowId: null,
    skippedRows: [],
  };

  for (const row of table.rows) {
    const result = rowMatches(
      row,
      table.cols,
      normalisedInputs,
      logic.fieldDefs,
    );
    if (result.matched) {
      stepTrace.matchedRowId = row.id;
      if (row.conclusion.type === 'terminal') {
        return {
          status: 'ok',
          outputs: row.conclusion.outputs,
          trace: [...previousTrace, stepTrace],
        };
      }
      if (row.conclusion.type === 'continue') {
        return evaluateTable(
          row.conclusion.tableId,
          normalisedInputs,
          logic,
          [...previousTrace, stepTrace],
          depth + 1,
        );
      }
    } else {
      stepTrace.skippedRows.push({
        rowId: row.id,
        failedColId: result.failedColId!,
      });
    }
  }

  return { status: 'no_match', tableId, trace: [...previousTrace, stepTrace] };
}
