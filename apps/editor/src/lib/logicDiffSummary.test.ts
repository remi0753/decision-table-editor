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
});
