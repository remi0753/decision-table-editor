import type { Logic } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import {
  analyzeWorkspaceDecision,
  valuesFromInitialInputs,
} from './workspaceAnalysis.js';

const logic: Logic = {
  version: '2',
  name: 'Refund',
  entryTableId: 't1',
  fieldDefs: {
    f1: {
      id: 'f1',
      name: 'Customer Tier',
      type: 'enum',
      enumValues: ['Gold', 'Basic'],
    },
    f2: { id: 'f2', name: 'Opened', type: 'bool' },
    f3: { id: 'f3', name: 'Amount', type: 'number' },
  },
  tables: {
    t1: {
      id: 't1',
      name: 'Entry',
      cols: [
        { id: 'c1', fieldId: 'f1' },
        { id: 'c2', fieldId: 'f2' },
        { id: 'c3', fieldId: 'f3' },
      ],
      outputCols: [{ id: 'oc1', name: 'Decision' }],
      rows: [
        {
          id: 'r1',
          cells: {
            c1: { op: '=', val: 'Gold' },
            c2: { op: '=', val: 'false' },
          },
          conclusion: { type: 'terminal', outputs: { oc1: 'Approve' } },
        },
        {
          id: 'r2',
          cells: {
            c1: { op: '=', val: 'Gold' },
            c2: { op: '=', val: 'true' },
          },
          conclusion: { type: 'terminal', outputs: { oc1: 'Review' } },
        },
        {
          id: 'r3',
          cells: {
            c1: { op: '=', val: 'Basic' },
          },
          conclusion: { type: 'terminal', outputs: { oc1: 'Deny' } },
        },
        {
          id: 'r4',
          cells: {
            c3: { op: '>=', val: '1000' },
          },
          conclusion: { type: 'terminal', outputs: { oc1: 'Review' } },
        },
      ],
    },
  },
  nField: 4,
  nTable: 2,
  nCol: 4,
  nOCol: 2,
  nRow: 5,
};

describe('analyzeWorkspaceDecision', () => {
  it('asks for a blocking field instead of showing every field', () => {
    const values = valuesFromInitialInputs(logic, { f1: 'Gold' }, 'manual');
    const state = analyzeWorkspaceDecision(logic, values);

    expect(state.status).toBe('needs_input');
    expect(state.missingFieldIds).toContain('f2');
    expect(state.recommendedChecks[0]?.fieldIds).toEqual(['f2']);
  });

  it('does not claim an early decision when an earlier possible row can differ', () => {
    const values = valuesFromInitialInputs(logic, { f3: '1200' }, 'manual');
    const state = analyzeWorkspaceDecision(logic, values);

    expect(state.status).toBe('needs_input');
    expect(state.possibleOutcomes.map((outcome) => outcome.label)).toContain(
      'Approve',
    );
    expect(state.possibleOutcomes.map((outcome) => outcome.label)).toContain(
      'Review',
    );
  });

  it('returns decision_ready when known facts determine one output', () => {
    const values = valuesFromInitialInputs(
      logic,
      { f1: 'Gold', f2: 'false' },
      'manual',
    );
    const state = analyzeWorkspaceDecision(logic, values);

    expect(state.status).toBe('decision_ready');
    expect(state.finalResult?.status).toBe('ok');
    if (state.finalResult?.status === 'ok') {
      expect(state.finalResult.outputs).toEqual({ oc1: 'Approve' });
    }
  });
});
