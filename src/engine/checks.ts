import type { Cell, Col, Logic, Row, Table } from '@/types/logic';

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
