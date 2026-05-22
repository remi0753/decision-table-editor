import type { Logic } from '@leverie/engine';

export const apiBaseUrl =
  process.env.E2E_API_BASE_URL ?? 'http://localhost:8787';

export function uniqueName(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeUser(prefix = 'e2e') {
  const id = uniqueName(prefix);
  return {
    email: `${id}@example.test`,
    name: `E2E ${id}`,
    password: 'password123456',
  };
}

export function makeLogic(name = 'E2E approval logic'): Logic {
  return {
    version: '2',
    name,
    description: 'Created by local E2E',
    entryTableId: 't1',
    fieldDefs: {
      f1: { id: 'f1', name: 'Amount', type: 'number' },
      f2: {
        id: 'f2',
        name: 'Tier',
        type: 'enum',
        enumValues: ['standard', 'vip'],
      },
    },
    tables: {
      t1: {
        id: 't1',
        name: 'Main',
        cols: [
          { id: 'c1', fieldId: 'f1' },
          { id: 'c2', fieldId: 'f2' },
        ],
        outputCols: [{ id: 'oc1', name: 'Decision' }],
        rows: [
          {
            id: 'r1',
            cells: {
              c1: { op: '<=', val: '1000' },
              c2: { op: '=', val: 'standard' },
            },
            conclusion: {
              type: 'terminal',
              outputs: { oc1: 'approve' },
            },
          },
          {
            id: 'r2',
            cells: {
              c1: { op: '>', val: '1000' },
            },
            conclusion: {
              type: 'terminal',
              outputs: { oc1: 'review' },
            },
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
