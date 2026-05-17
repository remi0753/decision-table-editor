import type { Cell, Col, FieldDef, Logic, Row, Table } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import { findContradictoryRows } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(
  id: string,
  type: FieldDef['type'],
  enumValues?: string[],
): FieldDef {
  return { id, name: id, type, enumValues };
}

function makeCol(id: string, fieldId: string | null): Col {
  return { id, fieldId };
}

function makeRow(id: string, cells: Record<string, Cell>): Row {
  return {
    id,
    cells,
    conclusion: { type: 'terminal', outputs: {} },
  };
}

function makeTable(cols: Col[], rows: Row[]): Table {
  return {
    id: 't1',
    name: 'T1',
    cols,
    outputCols: [],
    rows,
  };
}

function makeFieldDefs(...fields: FieldDef[]): Logic['fieldDefs'] {
  return Object.fromEntries(fields.map((f) => [f.id, f]));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findContradictoryRows — empty cell boundary condition', () => {
  it('does NOT flag a row where one of the same-field columns has no cell (wildcard)', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      // c2 has no cell → wildcard
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });

  it('DOES flag a row where op="null" contradicts op="=" (not the same as empty cell)', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: 'null' },
      c2: { op: '=', val: '1' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
    const info = result.get('r1')!;
    expect(info.colIds.has('c1')).toBe(true);
    expect(info.colIds.has('c2')).toBe(true);
  });
});

describe('findContradictoryRows — L1: equal values differ', () => {
  it('flags X = 1 AND X = 2', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: '=', val: '2' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('does NOT flag X = 1 AND X = 1', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: '=', val: '1' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });
});

describe('findContradictoryRows — L2: equal vs not-equal same value', () => {
  it('flags X = 1 AND X != 1', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: '!=', val: '1' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('does NOT flag X = 1 AND X != 2 (redundant, not contradictory)', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: '!=', val: '2' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });
});

describe('findContradictoryRows — L3: range intersection empty (numbers)', () => {
  it('flags X >= 10 AND X <= 5', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '>=', val: '10' },
      c2: { op: '<=', val: '5' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('flags X > 5 AND X < 5', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '>', val: '5' },
      c2: { op: '<', val: '5' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('does NOT flag X >= 5 AND X <= 10', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '>=', val: '5' },
      c2: { op: '<=', val: '10' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });

  it('flags X = 1 AND X >= 10 (number field)', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: '>=', val: '10' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('does NOT flag X = 5 AND X >= 5', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '5' },
      c2: { op: '>=', val: '5' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });

  it('does NOT apply L3 for string fields', () => {
    const col1 = makeCol('c1', 'name');
    const col2 = makeCol('c2', 'name');
    const row = makeRow('r1', {
      c1: { op: '>=', val: 'z' },
      c2: { op: '<=', val: 'a' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('name', 'string'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });
});

describe('findContradictoryRows — L4: equal value not in set', () => {
  it('flags X = 1 AND X in [2, 3]', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: 'in', val: ['2', '3'] },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('does NOT flag X = 1 AND X in [1, 2]', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: 'in', val: ['1', '2'] },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });
});

describe('findContradictoryRows — L5: equal value not in between range', () => {
  it('flags X = 1 AND X between [10, 20]', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: 'between', val: ['10', '20'] },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('does NOT flag X = 15 AND X between [10, 20]', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '15' },
      c2: { op: 'between', val: ['10', '20'] },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });
});

describe('findContradictoryRows — L6: null vs concrete constraint', () => {
  it('flags X is null AND X = 1', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: 'null' },
      c2: { op: '=', val: '1' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });

  it('flags X is null AND X >= 1', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: 'null' },
      c2: { op: '>=', val: '1' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
  });
});

describe('findContradictoryRows — multi-field independence', () => {
  it('only flags columns that share the same field', () => {
    const colA = makeCol('cA', 'age');
    const colB = makeCol('cB', 'name');
    // age = 1 AND name = 2 — different fields, no contradiction
    const row = makeRow('r1', {
      cA: { op: '=', val: '1' },
      cB: { op: '=', val: '2' },
    });
    const table = makeTable([colA, colB], [row]);
    const fieldDefs = makeFieldDefs(
      makeField('age', 'number'),
      makeField('name', 'string'),
    );

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(0);
  });

  it('only marks the contradicting row, not a clean row', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const badRow = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: '=', val: '2' },
    });
    const goodRow = makeRow('r2', {
      c1: { op: '=', val: '5' },
      c2: { op: '=', val: '5' },
    });
    const table = makeTable([col1, col2], [badRow, goodRow]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    expect(result.size).toBe(1);
    expect(result.has('r1')).toBe(true);
    expect(result.has('r2')).toBe(false);
  });
});

describe('findContradictoryRows — pairs metadata', () => {
  it('records the correct fieldId in pairs', () => {
    const col1 = makeCol('c1', 'age');
    const col2 = makeCol('c2', 'age');
    const row = makeRow('r1', {
      c1: { op: '=', val: '1' },
      c2: { op: '=', val: '2' },
    });
    const table = makeTable([col1, col2], [row]);
    const fieldDefs = makeFieldDefs(makeField('age', 'number'));

    const result = findContradictoryRows(table, fieldDefs);
    const info = result.get('r1')!;
    expect(info.pairs).toHaveLength(1);
    expect(info.pairs[0]!.fieldId).toBe('age');
    expect(info.pairs[0]!.colIdA).toBe('c1');
    expect(info.pairs[0]!.colIdB).toBe('c2');
  });
});
