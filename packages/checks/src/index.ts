import type { Cell, Col, FieldDef, Logic, Row, Table } from '@leverie/engine';

export function canReference(
  fromTableId: string,
  toTableId: string,
  tables: Logic['tables'],
): boolean {
  const visited = new Set<string>();
  const stack = [toTableId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromTableId) return false;
    if (visited.has(current)) continue;
    const table = tables[current];
    if (!table) continue;
    visited.add(current);
    for (const row of table.rows) {
      if (row.conclusion.type === 'continue') {
        stack.push(row.conclusion.tableId);
      }
    }
  }
  return true;
}

function areCellsIdentical(
  cells1: Record<string, Cell>,
  cells2: Record<string, Cell>,
  cols: Col[],
): boolean {
  for (const col of cols) {
    const c1 = cells1[col.id];
    const c2 = cells2[col.id];
    if (!c1 && !c2) continue;
    if (!c1 || !c2) return false;
    if (c1.op !== c2.op) return false;
    if (JSON.stringify(c1.val) !== JSON.stringify(c2.val)) return false;
  }
  return true;
}

export function findDuplicateRows(table: Table): Set<string> {
  const duplicates = new Set<string>();
  for (let i = 0; i < table.rows.length; i++) {
    for (let j = i + 1; j < table.rows.length; j++) {
      const ri = table.rows[i];
      const rj = table.rows[j];
      if (!ri || !rj) continue;
      if (areCellsIdentical(ri.cells, rj.cells, table.cols)) {
        duplicates.add(ri.id);
        duplicates.add(rj.id);
      }
    }
  }
  return duplicates;
}

function coversRow(rowA: Row, rowB: Row, cols: Col[]): boolean {
  const SKIP_OPS = new Set(['!=', '<', '<=', '>', '>=', 'in', 'between']);

  for (const col of cols) {
    const cellA = rowA.cells[col.id];
    const cellB = rowB.cells[col.id];

    if (cellA && SKIP_OPS.has(cellA.op)) return false;
    if (cellB && SKIP_OPS.has(cellB.op)) return false;

    if (!cellA) continue;
    if (!cellB) return false;
    if (cellA.op !== cellB.op) return false;
    if (JSON.stringify(cellA.val) !== JSON.stringify(cellB.val)) return false;
  }
  return true;
}

export function findUnreachableRows(table: Table): Set<string> {
  const unreachable = new Set<string>();
  for (let i = 0; i < table.rows.length; i++) {
    for (let j = i + 1; j < table.rows.length; j++) {
      const ri = table.rows[i];
      const rj = table.rows[j];
      if (!ri || !rj) continue;
      if (coversRow(ri, rj, table.cols)) {
        unreachable.add(rj.id);
      }
    }
  }
  return unreachable;
}

function cellCoversValue(cell: Cell, val: string): boolean {
  if (cell.op === '=') return String(cell.val) === val;
  if (cell.op === 'in' && Array.isArray(cell.val))
    return cell.val.includes(val);
  if (cell.op === '!=') return String(cell.val) !== val;
  return false;
}

export interface CoverageGap {
  branchPath: Array<{ colId: string; cell: Cell }>;
  missingCol: { colId: string; missingVal: string };
}

function collectCoverageGaps(
  rows: Row[],
  colIndex: number,
  cols: Col[],
  fieldDefs: Logic['fieldDefs'],
  pathSoFar: Array<{ colId: string; cell: Cell }>,
  result: CoverageGap[],
): void {
  if (rows.length === 0) return;
  if (colIndex >= cols.length) return;

  const col = cols[colIndex];
  if (!col) return;
  const field = col.fieldId ? fieldDefs[col.fieldId] : undefined;
  const anyRows = rows.filter((r) => !r.cells[col.id]);
  const specificRows = rows.filter((r) => !!r.cells[col.id]);

  if (field?.type === 'bool' || field?.type === 'enum') {
    const allValues =
      field.type === 'bool' ? ['true', 'false'] : (field.enumValues ?? []);
    for (const val of allValues) {
      const matchingSpecific = specificRows.filter((r) =>
        cellCoversValue(r.cells[col.id]!, val),
      );
      const rowsForVal = [...anyRows, ...matchingSpecific];
      if (rowsForVal.length === 0) {
        result.push({
          branchPath: [...pathSoFar],
          missingCol: { colId: col.id, missingVal: val },
        });
      } else {
        const repCell: Cell = matchingSpecific[0]?.cells[col.id] ?? {
          op: '=',
          val,
        };
        collectCoverageGaps(
          rowsForVal,
          colIndex + 1,
          cols,
          fieldDefs,
          [...pathSoFar, { colId: col.id, cell: repCell }],
          result,
        );
      }
    }
    return;
  }

  const groups = new Map<string, { cell: Cell; rows: Row[] }>();
  for (const r of specificRows) {
    const cell = r.cells[col.id]!;
    const key = `${cell.op}|${JSON.stringify(cell.val ?? null)}`;
    if (!groups.has(key)) groups.set(key, { cell, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  for (const group of groups.values()) {
    collectCoverageGaps(
      [...anyRows, ...group.rows],
      colIndex + 1,
      cols,
      fieldDefs,
      [...pathSoFar, { colId: col.id, cell: group.cell }],
      result,
    );
  }
  if (anyRows.length > 0) {
    collectCoverageGaps(
      anyRows,
      colIndex + 1,
      cols,
      fieldDefs,
      pathSoFar,
      result,
    );
  }
}

export function findCoverageGaps(
  table: Table,
  fieldDefs: Logic['fieldDefs'],
): CoverageGap[] {
  const result: CoverageGap[] = [];
  collectCoverageGaps(table.rows, 0, table.cols, fieldDefs, [], result);
  return result;
}

export function hasDefaultRow(
  table: Table,
  fieldDefs: Logic['fieldDefs'],
): boolean {
  return findCoverageGaps(table, fieldDefs).length === 0;
}

// Pair of column IDs within a row that are logically contradictory
export interface ContradictingPair {
  colIdA: string;
  colIdB: string;
  fieldId: string;
}

export interface ContradictoryInfo {
  // All column IDs involved in at least one contradiction (for cell-level styling)
  colIds: Set<string>;
  // Individual contradicting pairs (for tooltip detail)
  pairs: ContradictingPair[];
}

// Operators that imply the field value is non-null
const NON_NULL_OPS = new Set([
  '=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'between',
  'contains',
  'starts_with',
  'ends_with',
  'before_today',
  'today_or_before',
  'after_today',
  'today_or_after',
]);

function compareValues(
  x: string,
  y: string,
  fieldType: FieldDef['type'],
): number {
  if (fieldType === 'number') {
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return 0;
    return nx - ny;
  }
  // ISO date/datetime strings compare lexicographically
  return x < y ? -1 : x > y ? 1 : 0;
}

function isValueInRange(
  val: string,
  rangeVal: string[] | undefined,
  fieldType: FieldDef['type'],
): boolean {
  const lo = rangeVal?.[0] ?? '';
  const hi = rangeVal?.[1] ?? '';
  return (
    compareValues(val, lo, fieldType) >= 0 &&
    compareValues(val, hi, fieldType) <= 0
  );
}

/**
 * Returns true when cells a and b (sharing the same field) are logically
 * contradictory (L1–L6 per doc/discussion_editing_improvements.md §12).
 * Empty cells are NOT passed here — the caller filters them out.
 */
function areCellsContradictory(
  a: Cell,
  b: Cell,
  field: FieldDef | undefined,
): boolean {
  // L6: `null` op vs any concrete value constraint
  if (a.op === 'null' || b.op === 'null') {
    const other = a.op === 'null' ? b : a;
    return NON_NULL_OPS.has(other.op);
  }

  // L1: X = v AND X = w, v ≠ w
  if (a.op === '=' && b.op === '=') {
    return JSON.stringify(a.val) !== JSON.stringify(b.val);
  }

  // L2: X = v AND X != v
  if (a.op === '=' && b.op === '!=') return a.val === b.val;
  if (b.op === '=' && a.op === '!=') return b.val === a.val;

  // L4: X = v AND X in [...] where v is not in the set
  if (a.op === '=' && b.op === 'in') {
    if (Array.isArray(b.val) && typeof a.val === 'string') {
      return !b.val.includes(a.val);
    }
  }
  if (b.op === '=' && a.op === 'in') {
    if (Array.isArray(a.val) && typeof b.val === 'string') {
      return !a.val.includes(b.val);
    }
  }

  // L5: X = v AND X between [lo, hi] where v ∉ [lo, hi]
  if (a.op === '=' && b.op === 'between') {
    if (Array.isArray(b.val) && typeof a.val === 'string' && field) {
      return !isValueInRange(a.val, b.val, field.type);
    }
  }
  if (b.op === '=' && a.op === 'between') {
    if (Array.isArray(a.val) && typeof b.val === 'string' && field) {
      return !isValueInRange(b.val, a.val, field.type);
    }
  }

  // L3: numeric/date range intersection is empty
  if (
    field &&
    (field.type === 'number' ||
      field.type === 'date' ||
      field.type === 'datetime')
  ) {
    return areRangesContradictory(a, b, field.type);
  }

  return false;
}

/**
 * L3: checks whether two range-style constraints on a numeric/date field
 * are mutually exclusive.
 * Also handles = vs comparison operators (e.g. X = 1 AND X >= 10).
 */
function areRangesContradictory(
  a: Cell,
  b: Cell,
  fieldType: 'number' | 'date' | 'datetime',
): boolean {
  const valA = typeof a.val === 'string' ? a.val : null;
  const valB = typeof b.val === 'string' ? b.val : null;

  // Normalise to (lower-bound op, upper-bound op) to check for empty intersection
  const lowerOps = new Set(['>', '>=']);
  const upperOps = new Set(['<', '<=']);

  // a is lower bound, b is upper bound
  if (lowerOps.has(a.op) && upperOps.has(b.op) && valA && valB) {
    const cmp = compareValues(valA, valB, fieldType);
    if (a.op === '>=' && b.op === '<=') return cmp > 0; // [valA, valB] empty when valA > valB
    if (a.op === '>=' && b.op === '<') return cmp >= 0; // >= 5 AND < 5 → nothing
    if (a.op === '>' && b.op === '<=') return cmp >= 0;
    if (a.op === '>' && b.op === '<') return cmp >= 0;
  }

  // b is lower bound, a is upper bound
  if (lowerOps.has(b.op) && upperOps.has(a.op) && valA && valB) {
    const cmp = compareValues(valB, valA, fieldType);
    if (b.op === '>=' && a.op === '<=') return cmp > 0;
    if (b.op === '>=' && a.op === '<') return cmp >= 0;
    if (b.op === '>' && a.op === '<=') return cmp >= 0;
    if (b.op === '>' && a.op === '<') return cmp >= 0;
  }

  // = vs comparison operator: check whether the equal value satisfies the constraint
  if (a.op === '=' && valA && valB) {
    const cmp = compareValues(valA, valB, fieldType);
    if (b.op === '<') return cmp >= 0; // = 5 AND < 5 → impossible
    if (b.op === '<=') return cmp > 0;
    if (b.op === '>') return cmp <= 0;
    if (b.op === '>=') return cmp < 0;
  }
  if (b.op === '=' && valB && valA) {
    const cmp = compareValues(valB, valA, fieldType);
    if (a.op === '<') return cmp >= 0;
    if (a.op === '<=') return cmp > 0;
    if (a.op === '>') return cmp <= 0;
    if (a.op === '>=') return cmp < 0;
  }

  return false;
}

/**
 * Finds rows where the same field is constrained by two or more columns in a
 * mutually contradictory way (L1–L6). Returns a map from rowId → info about
 * which columns are involved.
 */
export function findContradictoryRows(
  table: Table,
  fieldDefs: Logic['fieldDefs'],
): Map<string, ContradictoryInfo> {
  const result = new Map<string, ContradictoryInfo>();

  for (const row of table.rows) {
    // Group columns that have a concrete cell by fieldId
    const byFieldId = new Map<string, Array<{ colId: string; cell: Cell }>>();

    for (const col of table.cols) {
      if (!col.fieldId) continue;
      const cell = row.cells[col.id];
      if (!cell) continue; // empty cell = wildcard, not a constraint
      const entries = byFieldId.get(col.fieldId) ?? [];
      entries.push({ colId: col.id, cell });
      byFieldId.set(col.fieldId, entries);
    }

    const contradictingColIds = new Set<string>();
    const pairs: ContradictingPair[] = [];

    for (const [fieldId, entries] of byFieldId) {
      if (entries.length < 2) continue;
      const field = fieldDefs[fieldId];

      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const ea = entries[i]!;
          const eb = entries[j]!;
          if (areCellsContradictory(ea.cell, eb.cell, field)) {
            contradictingColIds.add(ea.colId);
            contradictingColIds.add(eb.colId);
            pairs.push({ colIdA: ea.colId, colIdB: eb.colId, fieldId });
          }
        }
      }
    }

    if (contradictingColIds.size > 0) {
      result.set(row.id, { colIds: contradictingColIds, pairs });
    }
  }

  return result;
}

export interface CoverageResult {
  totalCombinations: number;
  uncoveredCombinations: string[][];
  isTruncated: boolean;
}

function generateCartesian(arrays: string[][]): string[][] {
  if (arrays.length === 0) return [[]];
  const first = arrays[0];
  const rest = arrays.slice(1);
  const restCart = generateCartesian(rest);
  const result: string[][] = [];
  for (const val of first ?? []) {
    for (const combo of restCart) {
      result.push([val, ...combo]);
    }
  }
  return result;
}

export function checkCoverage(
  table: Table,
  fieldDefs: Logic['fieldDefs'],
): CoverageResult | null {
  const targetCols = table.cols.filter((col) => {
    if (!col.fieldId) return false;
    const field = fieldDefs[col.fieldId];
    return field && (field.type === 'enum' || field.type === 'bool');
  });
  if (targetCols.length === 0) return null;

  const valuesList: string[][] = targetCols.map((col) => {
    const field = fieldDefs[col.fieldId!]!;
    return field.type === 'bool' ? ['true', 'false'] : (field.enumValues ?? []);
  });

  const total = valuesList.reduce((acc, vals) => acc * vals.length, 1);
  const cartesian = generateCartesian(valuesList);

  const uncovered: string[][] = [];
  for (const combo of cartesian) {
    const covered = table.rows.some((row) => {
      return targetCols.every((col, i) => {
        const cell = row.cells[col.id];
        if (!cell) return true;
        const val = combo[i]!;
        if (cell.op === 'null') return false;
        if (cell.op === '=') return cell.val === val;
        if (cell.op === '!=') return cell.val !== val;
        if (cell.op === 'in' && Array.isArray(cell.val))
          return cell.val.includes(val);
        return false;
      });
    });
    if (!covered) uncovered.push(combo);
  }

  const TRUNCATE_LIMIT = 64;
  return {
    totalCombinations: total,
    uncoveredCombinations: uncovered.slice(0, TRUNCATE_LIMIT),
    isTruncated: uncovered.length > TRUNCATE_LIMIT,
  };
}
