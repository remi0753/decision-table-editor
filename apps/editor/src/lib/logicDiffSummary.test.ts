import type { Logic } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import { buildLogicDiffSummary } from './logicDiffSummary';

const options = {
  operatorLabels: { '=': 'Equals' },
  wildcardLabel: 'No condition',
  unsetLabel: '(unset)',
  terminalLabel: 'Terminal',
  continueLabel: 'Continue',
  tableNotFoundLabel: 'Table not found',
};

function baseLogic(): Logic {
  return {
    version: '2',
    name: 'Example',
    entryTableId: 't1',
    fieldDefs: {
      f1: { id: 'f1', name: 'Contract type', type: 'enum' },
      f2: { id: 'f2', name: 'Amount', type: 'number' },
    },
    tables: {
      t1: {
        id: 't1',
        name: 'Main',
        cols: [
          { id: 'c1', fieldId: 'f1' },
          { id: 'c2', fieldId: 'f2' },
        ],
        outputCols: [{ id: 'oc1', name: 'Approval' }],
        rows: [
          {
            id: 'r1',
            cells: { c1: { op: '=', val: 'Individual' } },
            conclusion: { type: 'terminal', outputs: { oc1: 'Approve' } },
          },
          {
            id: 'r2',
            cells: { c1: { op: '=', val: 'Corporate' } },
            conclusion: { type: 'terminal', outputs: { oc1: 'Review' } },
          },
        ],
      },
    },
    nField: 3,
    nTable: 2,
    nCol: 3,
    nOCol: 2,
    nRow: 3,
  };
}

describe('buildLogicDiffSummary', () => {
  it('counts changed rules and changed condition/result cells separately', () => {
    const before = baseLogic();
    const after = baseLogic();
    after.tables.t1!.rows[0] = {
      ...after.tables.t1!.rows[0]!,
      cells: {
        c1: { op: '=', val: 'Corporate' },
        c2: { op: '=', val: '1000000' },
      },
      conclusion: { type: 'terminal', outputs: { oc1: 'Manager review' } },
    };

    const summary = buildLogicDiffSummary(before, after, options);

    expect(summary.addedRules).toBe(0);
    expect(summary.removedRules).toBe(0);
    expect(summary.changedRules).toBe(1);
    expect(summary.conditionCellChanges).toBe(2);
    expect(summary.resultCellChanges).toBe(1);
    expect(summary.ruleDiffs[0]).toMatchObject({
      tableName: 'Main',
      rowId: 'r1',
      kind: 'changed',
      conditionChanges: [
        {
          label: 'Contract type',
          before: 'Equals Individual',
          after: 'Equals Corporate',
        },
        { label: 'Amount', before: 'No condition', after: 'Equals 1000000' },
      ],
      resultChanges: [
        {
          label: 'Approval',
          before: 'Approve',
          after: 'Manager review',
        },
      ],
    });
  });

  it('counts added and removed rows as rule changes, not changed cells', () => {
    const before = baseLogic();
    const after = baseLogic();
    after.tables.t1!.rows = [
      after.tables.t1!.rows[0]!,
      {
        id: 'r3',
        cells: { c1: { op: '=', val: 'Partner' } },
        conclusion: { type: 'terminal', outputs: { oc1: 'Escalate' } },
      },
    ];

    const summary = buildLogicDiffSummary(before, after, options);

    expect(summary.addedRules).toBe(1);
    expect(summary.removedRules).toBe(1);
    expect(summary.changedRules).toBe(0);
    expect(summary.conditionCellChanges).toBe(0);
    expect(summary.resultCellChanges).toBe(0);
  });

  it('builds a per-cell table grid marking each cell status', () => {
    const before = baseLogic();
    const after = baseLogic();
    after.tables.t1!.rows[0] = {
      ...after.tables.t1!.rows[0]!,
      cells: {
        c1: { op: '=', val: 'Corporate' },
        c2: { op: '=', val: '1000000' },
      },
      conclusion: { type: 'terminal', outputs: { oc1: 'Manager review' } },
    };

    const summary = buildLogicDiffSummary(before, after, options);
    const grid = summary.tableGrids.find((g) => g.tableId === 't1');

    expect(grid).toBeDefined();
    expect(grid?.hasChanges).toBe(true);
    expect(grid?.changedRows).toBe(1);
    expect(grid?.columns.map((c) => c.kind)).toEqual([
      'condition',
      'condition',
      'output',
    ]);

    const changedRow = grid?.rows.find((r) => r.rowId === 'r1');
    expect(changedRow?.kind).toBe('changed');
    expect(changedRow?.hasRuleDiff).toBe(true);
    expect(changedRow?.cells.map((c) => c.status)).toEqual([
      'changed', // c1 condition changed
      'changed', // c2 condition added
      'changed', // oc1 result changed
    ]);

    const untouchedRow = grid?.rows.find((r) => r.rowId === 'r2');
    expect(untouchedRow?.kind).toBe('unchanged');
    expect(untouchedRow?.cells.every((c) => c.status === 'unchanged')).toBe(
      true,
    );
  });

  it('marks added and removed grid rows uniformly and flags reorders', () => {
    const before = baseLogic();
    const after = baseLogic();
    // Drop r1, add r3, leaving r2 shifted to the top (reordered).
    after.tables.t1!.rows = [
      after.tables.t1!.rows[1]!,
      {
        id: 'r3',
        cells: { c1: { op: '=', val: 'Partner' } },
        conclusion: { type: 'terminal', outputs: { oc1: 'Escalate' } },
      },
    ];

    const summary = buildLogicDiffSummary(before, after, options);
    const grid = summary.tableGrids.find((g) => g.tableId === 't1');

    const removed = grid?.rows.find((r) => r.rowId === 'r1');
    expect(removed?.kind).toBe('removed');
    expect(removed?.cells.every((c) => c.status === 'removed')).toBe(true);

    const added = grid?.rows.find((r) => r.rowId === 'r3');
    expect(added?.kind).toBe('added');
    expect(added?.cells.every((c) => c.status === 'added')).toBe(true);

    const reordered = grid?.rows.find((r) => r.rowId === 'r2');
    expect(reordered?.kind).toBe('changed');
    expect(reordered?.reordered).toBe(true);
    expect(reordered?.cells.every((c) => c.status === 'unchanged')).toBe(true);
  });
});
