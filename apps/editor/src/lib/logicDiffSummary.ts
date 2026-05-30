import type { Cell, Logic, Row, Table } from '@leverie/engine';

export type FormatDiffOptions = {
  operatorLabels: Record<string, string>;
  wildcardLabel: string;
  unsetLabel: string;
  terminalLabel: string;
  continueLabel: string;
  tableNotFoundLabel: string;
};

export type CellDiff = {
  label: string;
  before: string;
  after: string;
};

export type RuleDiff = {
  id: string;
  tableId: string;
  tableName: string;
  rowId: string;
  kind: 'added' | 'removed' | 'changed';
  beforeRowNumber?: number;
  afterRowNumber?: number;
  beforeConditions: CellDiff[];
  afterConditions: CellDiff[];
  beforeResults: CellDiff[];
  afterResults: CellDiff[];
  conditionChanges: CellDiff[];
  resultChanges: CellDiff[];
  priorityChange?: {
    before: number;
    after: number;
  };
};

export type LogicDiffSummary = {
  addedRules: number;
  removedRules: number;
  changedRules: number;
  conditionCellChanges: number;
  resultCellChanges: number;
  priorityChanges: number;
  ruleDiffs: RuleDiff[];
};

function stableStringify(value: unknown): string {
  if (value === undefined) return '';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    )
    .join(',')}}`;
}

function sameValue(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function valueText(value: string | string[] | undefined, unsetLabel: string) {
  if (value === undefined) return unsetLabel;
  if (Array.isArray(value)) {
    return value.length === 0 ? unsetLabel : value.join(', ');
  }
  return value === '' ? unsetLabel : value;
}

function formatCell(
  cell: Cell | undefined,
  options: FormatDiffOptions,
): string {
  if (!cell) return options.wildcardLabel;
  const operator = options.operatorLabels[cell.op] ?? cell.op;
  if (cell.op === 'null') return operator;
  return `${operator} ${valueText(cell.val, options.unsetLabel)}`;
}

function conditionLabel(table: Table | undefined, logic: Logic, colId: string) {
  const col = table?.cols.find((item) => item.id === colId);
  if (!col?.fieldId) return colId;
  return logic.fieldDefs[col.fieldId]?.name ?? col.fieldId;
}

function outputLabel(table: Table | undefined, outputColId: string) {
  return (
    table?.outputCols.find((item) => item.id === outputColId)?.name ??
    outputColId
  );
}

function tableName(logic: Logic, tableId: string, fallback: string) {
  return logic.tables[tableId]?.name ?? fallback;
}

function orderedConditionColIds(before?: Table, after?: Table) {
  return Array.from(
    new Set([
      ...(before?.cols.map((col) => col.id) ?? []),
      ...(after?.cols.map((col) => col.id) ?? []),
    ]),
  );
}

function orderedOutputColIds(before?: Table, after?: Table) {
  return Array.from(
    new Set([
      ...(before?.outputCols.map((col) => col.id) ?? []),
      ...(after?.outputCols.map((col) => col.id) ?? []),
    ]),
  );
}

function rowConditions(
  logic: Logic,
  table: Table | undefined,
  row: Row | undefined,
  colIds: string[],
  options: FormatDiffOptions,
): CellDiff[] {
  if (!row) return [];
  return colIds.map((colId) => ({
    label: conditionLabel(table, logic, colId),
    before: '',
    after: formatCell(row.cells[colId], options),
  }));
}

function rowResults(
  logic: Logic,
  table: Table | undefined,
  row: Row | undefined,
  outputColIds: string[],
  options: FormatDiffOptions,
): CellDiff[] {
  if (!row) return [];
  const conclusion = row.conclusion;
  if (conclusion.type === 'continue') {
    return [
      {
        label: options.continueLabel,
        before: '',
        after: tableName(logic, conclusion.tableId, options.tableNotFoundLabel),
      },
    ];
  }
  return outputColIds.map((outputColId) => ({
    label: outputLabel(table, outputColId),
    before: '',
    after: conclusion.outputs[outputColId] || options.unsetLabel,
  }));
}

function conditionChanges(
  beforeLogic: Logic,
  afterLogic: Logic,
  beforeTable: Table | undefined,
  afterTable: Table | undefined,
  beforeRow: Row,
  afterRow: Row,
  colIds: string[],
  options: FormatDiffOptions,
): CellDiff[] {
  return colIds.flatMap((colId) => {
    const before = beforeRow.cells[colId];
    const after = afterRow.cells[colId];
    if (sameValue(before, after)) return [];
    return [
      {
        label:
          conditionLabel(afterTable, afterLogic, colId) ??
          conditionLabel(beforeTable, beforeLogic, colId),
        before: formatCell(before, options),
        after: formatCell(after, options),
      },
    ];
  });
}

function resultChanges(
  beforeLogic: Logic,
  afterLogic: Logic,
  beforeTable: Table | undefined,
  afterTable: Table | undefined,
  beforeRow: Row,
  afterRow: Row,
  outputColIds: string[],
  options: FormatDiffOptions,
): CellDiff[] {
  if (beforeRow.conclusion.type !== afterRow.conclusion.type) {
    return [
      {
        label: options.terminalLabel,
        before:
          beforeRow.conclusion.type === 'terminal'
            ? options.terminalLabel
            : options.continueLabel,
        after:
          afterRow.conclusion.type === 'terminal'
            ? options.terminalLabel
            : options.continueLabel,
      },
    ];
  }

  if (
    beforeRow.conclusion.type === 'continue' &&
    afterRow.conclusion.type === 'continue'
  ) {
    if (beforeRow.conclusion.tableId === afterRow.conclusion.tableId) return [];
    return [
      {
        label: options.continueLabel,
        before: tableName(
          beforeLogic,
          beforeRow.conclusion.tableId,
          options.tableNotFoundLabel,
        ),
        after: tableName(
          afterLogic,
          afterRow.conclusion.tableId,
          options.tableNotFoundLabel,
        ),
      },
    ];
  }

  if (
    beforeRow.conclusion.type !== 'terminal' ||
    afterRow.conclusion.type !== 'terminal'
  ) {
    return [];
  }

  return outputColIds.flatMap((outputColId) => {
    const before =
      beforeRow.conclusion.type === 'terminal'
        ? beforeRow.conclusion.outputs[outputColId] || ''
        : '';
    const after =
      afterRow.conclusion.type === 'terminal'
        ? afterRow.conclusion.outputs[outputColId] || ''
        : '';
    if (before === after) return [];
    return [
      {
        label:
          outputLabel(afterTable, outputColId) ??
          outputLabel(beforeTable, outputColId),
        before: before || options.unsetLabel,
        after: after || options.unsetLabel,
      },
    ];
  });
}

export function buildLogicDiffSummary(
  beforeLogic: Logic,
  afterLogic: Logic,
  options: FormatDiffOptions,
): LogicDiffSummary {
  const tableIds = Array.from(
    new Set([
      ...Object.keys(beforeLogic.tables),
      ...Object.keys(afterLogic.tables),
    ]),
  );

  const ruleDiffs: RuleDiff[] = [];

  for (const tableId of tableIds) {
    const beforeTable = beforeLogic.tables[tableId];
    const afterTable = afterLogic.tables[tableId];
    const rowIds = Array.from(
      new Set([
        ...(beforeTable?.rows.map((row) => row.id) ?? []),
        ...(afterTable?.rows.map((row) => row.id) ?? []),
      ]),
    );
    const colIds = orderedConditionColIds(beforeTable, afterTable);
    const outputColIds = orderedOutputColIds(beforeTable, afterTable);

    for (const rowId of rowIds) {
      const beforeIndex = beforeTable
        ? beforeTable.rows.findIndex((row) => row.id === rowId)
        : -1;
      const afterIndex = afterTable
        ? afterTable.rows.findIndex((row) => row.id === rowId)
        : -1;
      const beforeRow =
        beforeIndex < 0 ? undefined : beforeTable?.rows[beforeIndex];
      const afterRow =
        afterIndex < 0 ? undefined : afterTable?.rows[afterIndex];
      const resolvedTableName =
        afterTable?.name ?? beforeTable?.name ?? tableId;

      if (!beforeRow && afterRow) {
        ruleDiffs.push({
          id: `${tableId}:${rowId}`,
          tableId,
          tableName: resolvedTableName,
          rowId,
          kind: 'added',
          afterRowNumber: afterIndex + 1,
          beforeConditions: [],
          afterConditions: rowConditions(
            afterLogic,
            afterTable,
            afterRow,
            colIds,
            options,
          ),
          beforeResults: [],
          afterResults: rowResults(
            afterLogic,
            afterTable,
            afterRow,
            outputColIds,
            options,
          ),
          conditionChanges: [],
          resultChanges: [],
        });
        continue;
      }

      if (beforeRow && !afterRow) {
        ruleDiffs.push({
          id: `${tableId}:${rowId}`,
          tableId,
          tableName: resolvedTableName,
          rowId,
          kind: 'removed',
          beforeRowNumber: beforeIndex + 1,
          beforeConditions: rowConditions(
            beforeLogic,
            beforeTable,
            beforeRow,
            colIds,
            options,
          ),
          afterConditions: [],
          beforeResults: rowResults(
            beforeLogic,
            beforeTable,
            beforeRow,
            outputColIds,
            options,
          ),
          afterResults: [],
          conditionChanges: [],
          resultChanges: [],
        });
        continue;
      }

      if (!beforeRow || !afterRow) continue;

      const conditions = conditionChanges(
        beforeLogic,
        afterLogic,
        beforeTable,
        afterTable,
        beforeRow,
        afterRow,
        colIds,
        options,
      );
      const results = resultChanges(
        beforeLogic,
        afterLogic,
        beforeTable,
        afterTable,
        beforeRow,
        afterRow,
        outputColIds,
        options,
      );
      const priorityChange =
        beforeIndex >= 0 && afterIndex >= 0 && beforeIndex !== afterIndex
          ? { before: beforeIndex + 1, after: afterIndex + 1 }
          : undefined;

      if (conditions.length === 0 && results.length === 0 && !priorityChange) {
        continue;
      }

      ruleDiffs.push({
        id: `${tableId}:${rowId}`,
        tableId,
        tableName: resolvedTableName,
        rowId,
        kind: 'changed',
        beforeRowNumber: beforeIndex + 1,
        afterRowNumber: afterIndex + 1,
        beforeConditions: [],
        afterConditions: [],
        beforeResults: [],
        afterResults: [],
        conditionChanges: conditions,
        resultChanges: results,
        priorityChange,
      });
    }
  }

  return {
    addedRules: ruleDiffs.filter((diff) => diff.kind === 'added').length,
    removedRules: ruleDiffs.filter((diff) => diff.kind === 'removed').length,
    changedRules: ruleDiffs.filter((diff) => diff.kind === 'changed').length,
    conditionCellChanges: ruleDiffs.reduce(
      (sum, diff) => sum + diff.conditionChanges.length,
      0,
    ),
    resultCellChanges: ruleDiffs.reduce(
      (sum, diff) => sum + diff.resultChanges.length,
      0,
    ),
    priorityChanges: ruleDiffs.filter((diff) => diff.priorityChange).length,
    ruleDiffs,
  };
}
