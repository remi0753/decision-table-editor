import type { Logic } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import {
  analyzeWorkspaceDecision,
  buildRuntimeGroups,
  formatWorkspaceResultSummary,
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

describe('buildRuntimeGroups', () => {
  it('builds state-aware fallback groups when no groups are configured', () => {
    const values = valuesFromInitialInputs(logic, { f1: 'Gold' }, 'manual');
    const decision = analyzeWorkspaceDecision(logic, values);
    const groups = buildRuntimeGroups(logic, undefined, { values, decision });

    expect(groups.map((group) => group.name)).toEqual([
      'Needs attention',
      'Known facts',
      'Missing facts',
    ]);
    expect(
      groups.find((group) => group.id === 'needs_attention')?.fieldIds,
    ).toEqual(['f2']);
    expect(groups.find((group) => group.id === 'known')?.fieldIds).toEqual([
      'f1',
    ]);
    expect(groups.find((group) => group.id === 'missing')?.fieldIds).toEqual([
      'f3',
    ]);
  });

  it('keeps configured author groups as the primary grouping', () => {
    const groups = buildRuntimeGroups(logic, {
      version: '1',
      groups: [
        {
          id: 'customer',
          name: 'Customer',
          fieldIds: ['f1', 'missing-field'],
        },
      ],
    });

    expect(groups).toEqual([
      {
        id: 'customer',
        name: 'Customer',
        description: undefined,
        fieldIds: ['f1'],
        order: 0,
      },
      {
        id: 'other',
        name: 'Other',
        fieldIds: ['f2', 'f3'],
        order: Number.MAX_SAFE_INTEGER,
      },
    ]);
  });
});

describe('formatWorkspaceResultSummary', () => {
  it('builds copyable fallback text from output names and values', () => {
    const summary = formatWorkspaceResultSummary(
      logic,
      { oc1: 'Approve' },
      undefined,
      {},
      'v12',
    );

    expect(summary.title).toBe('Approve');
    expect(summary.reason).toBe('Evaluated by LEVERIE logic v12.');
    expect(summary.copyText).toContain('Approve');
    expect(summary.copyText).toContain('Decision: Approve');
  });

  it('uses a matching result template for title, reason, and copy text', () => {
    const values = valuesFromInitialInputs(logic, { f1: 'Gold' }, 'manual');
    const summary = formatWorkspaceResultSummary(
      logic,
      { oc1: 'Approve' },
      {
        version: '1',
        resultTemplates: [
          {
            id: 'approve',
            match: { outputValuesByColumnId: { oc1: 'Approve' } },
            title: 'Refund {{Decision}}',
            reasonTemplate: '{{Customer Tier}} customers can be approved.',
            customerMessageTemplate:
              'Your refund is {{Decision}} because your tier is {{field:Customer Tier}}.',
          },
        ],
      },
      values,
    );

    expect(summary.title).toBe('Refund Approve');
    expect(summary.reason).toBe('Gold customers can be approved.');
    expect(summary.copyText).toBe(
      'Your refund is Approve because your tier is Gold.',
    );
  });
});
