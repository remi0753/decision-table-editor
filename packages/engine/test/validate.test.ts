import { describe, expect, it } from 'vitest';
import type { Logic } from '../src/index.js';
import { validateLogicForSave } from '../src/index.js';

// Minimal valid Logic JSON v2 used as a starting point. Each test takes a
// deep copy via structuredClone and mutates one field to surface exactly the
// error code it asserts.
const baseline: Logic = {
  version: '2',
  name: 'Loan Review',
  entryTableId: 't1',
  fieldDefs: {
    f1: { id: 'f1', name: 'amount', type: 'number' },
    f2: {
      id: 'f2',
      name: 'tier',
      type: 'enum',
      enumValues: ['gold', 'silver'],
    },
  },
  tables: {
    t1: {
      id: 't1',
      name: 'Triage',
      cols: [
        { id: 'c1', fieldId: 'f1' },
        { id: 'c2', fieldId: 'f2' },
      ],
      outputCols: [{ id: 'oc1', name: 'decision' }],
      rows: [
        {
          id: 'r1',
          cells: {
            c1: { op: '>', val: '1000000' },
            c2: { op: '=', val: 'gold' },
          },
          conclusion: { type: 'terminal', outputs: { oc1: 'approve' } },
        },
        {
          id: 'r2',
          cells: {},
          conclusion: { type: 'continue', tableId: 't2' },
        },
      ],
    },
    t2: {
      id: 't2',
      name: 'Standard',
      cols: [{ id: 'c3', fieldId: 'f1' }],
      outputCols: [{ id: 'oc2', name: 'decision' }],
      rows: [
        {
          id: 'r3',
          cells: { c3: { op: 'between', val: ['0', '500000'] } },
          conclusion: { type: 'terminal', outputs: { oc2: 'reject' } },
        },
      ],
    },
  },
  nField: 3,
  nTable: 3,
  nCol: 4,
  nOCol: 3,
  nRow: 4,
};

function clone(): Logic {
  // Plain JSON round-trip is fine here: baseline holds only strings / numbers /
  // booleans / arrays / records. structuredClone() would also work but needs
  // ES2022 lib, which engine doesn't enable.
  return JSON.parse(JSON.stringify(baseline)) as Logic;
}

function expectError(
  result: ReturnType<typeof validateLogicForSave>,
  code: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  const codes = result.errors.map((e) => e.code);
  expect(codes).toContain(code);
}

describe('validateLogicForSave', () => {
  it('accepts the baseline as valid', () => {
    const res = validateLogicForSave(baseline);
    expect(res.ok).toBe(true);
  });

  it('reports shape_invalid for non-Logic input', () => {
    const res = validateLogicForSave({ version: '2' });
    expectError(res, 'shape_invalid');
  });

  it('1: entry_table_missing when entryTableId not in tables', () => {
    const logic = clone();
    logic.entryTableId = 't99';
    expectError(validateLogicForSave(logic), 'entry_table_missing');
  });

  it('2: continue_target_missing when continue points to absent table', () => {
    const logic = clone();
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    const r2 = t1.rows[1];
    if (!r2) throw new Error('r2 missing');
    r2.conclusion = { type: 'continue', tableId: 't99' };
    expectError(validateLogicForSave(logic), 'continue_target_missing');
  });

  it('3: col_field_missing when col.fieldId references absent field', () => {
    const logic = clone();
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    const c1 = t1.cols[0];
    if (!c1) throw new Error('c1 missing');
    c1.fieldId = 'f99';
    expectError(validateLogicForSave(logic), 'col_field_missing');
  });

  it('4: row_cell_col_missing when row.cells has key not in cols', () => {
    const logic = clone();
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    const r1 = t1.rows[0];
    if (!r1) throw new Error('r1 missing');
    r1.cells.c99 = { op: '=', val: 'x' };
    expectError(validateLogicForSave(logic), 'row_cell_col_missing');
  });

  it('5: terminal_output_col_missing when terminal outputs has unknown key', () => {
    const logic = clone();
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    const r1 = t1.rows[0];
    if (!r1) throw new Error('r1 missing');
    if (r1.conclusion.type !== 'terminal') throw new Error('not terminal');
    r1.conclusion.outputs.oc99 = 'x';
    expectError(validateLogicForSave(logic), 'terminal_output_col_missing');
  });

  it('6: field_name_duplicate when two fieldDefs share a name', () => {
    const logic = clone();
    logic.fieldDefs.f3 = {
      id: 'f3',
      name: 'amount',
      type: 'number',
    };
    logic.nField = 4;
    expectError(validateLogicForSave(logic), 'field_name_duplicate');
  });

  it('7: table_name_duplicate when two tables share a name', () => {
    const logic = clone();
    const t2 = logic.tables.t2;
    if (!t2) throw new Error('t2 missing');
    t2.name = 'Triage';
    expectError(validateLogicForSave(logic), 'table_name_duplicate');
  });

  it('8: output_col_name_duplicate_in_table', () => {
    const logic = clone();
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    t1.outputCols.push({ id: 'oc3', name: 'decision' });
    logic.nOCol = 4;
    expectError(
      validateLogicForSave(logic),
      'output_col_name_duplicate_in_table',
    );
  });

  it('9: enum_values_empty when enum field has no enumValues', () => {
    const logic = clone();
    logic.fieldDefs.f2 = { id: 'f2', name: 'tier', type: 'enum' };
    expectError(validateLogicForSave(logic), 'enum_values_empty');
  });

  it('10: enum_value_invalid when enum cell val not in enumValues', () => {
    const logic = clone();
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    const r1 = t1.rows[0];
    if (!r1) throw new Error('r1 missing');
    const cell = r1.cells.c2;
    if (!cell) throw new Error('c2 cell missing');
    cell.val = 'platinum';
    expectError(validateLogicForSave(logic), 'enum_value_invalid');
  });

  it('11: operator_type_mismatch when op is not allowed for field type', () => {
    const logic = clone();
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    const r1 = t1.rows[0];
    if (!r1) throw new Error('r1 missing');
    const cell = r1.cells.c2;
    if (!cell) throw new Error('c2 cell missing');
    // enum doesn't allow contains
    cell.op = 'contains';
    cell.val = 'gold';
    expectError(validateLogicForSave(logic), 'operator_type_mismatch');
  });

  it('12: operator_value_shape_mismatch for between with 1 value', () => {
    const logic = clone();
    const t2 = logic.tables.t2;
    if (!t2) throw new Error('t2 missing');
    const r3 = t2.rows[0];
    if (!r3) throw new Error('r3 missing');
    const cell = r3.cells.c3;
    if (!cell) throw new Error('c3 cell missing');
    cell.val = ['0'];
    expectError(validateLogicForSave(logic), 'operator_value_shape_mismatch');
  });

  it('13: output_cols_empty when table has no outputCols', () => {
    const logic = clone();
    const t2 = logic.tables.t2;
    if (!t2) throw new Error('t2 missing');
    t2.outputCols = [];
    expectError(validateLogicForSave(logic), 'output_cols_empty');
  });

  it('14: counter_inconsistent when nField <= max field suffix', () => {
    const logic = clone();
    logic.nField = 2;
    expectError(validateLogicForSave(logic), 'counter_inconsistent');
  });

  it('15: continue_cycle when continue graph has a cycle', () => {
    const logic = clone();
    const t2 = logic.tables.t2;
    if (!t2) throw new Error('t2 missing');
    const r3 = t2.rows[0];
    if (!r3) throw new Error('r3 missing');
    r3.conclusion = { type: 'continue', tableId: 't1' };
    expectError(validateLogicForSave(logic), 'continue_cycle');
  });

  it('16: id_key_mismatch when fieldDefs[k].id does not equal k', () => {
    const logic = clone();
    const f1 = logic.fieldDefs.f1;
    if (!f1) throw new Error('f1 missing');
    f1.id = 'f2';
    expectError(validateLogicForSave(logic), 'id_key_mismatch');
  });

  it('17: counter_format_invalid when nField is not a positive integer', () => {
    const logic = clone();
    (logic as unknown as { nField: number }).nField = 0;
    expectError(validateLogicForSave(logic), 'counter_format_invalid');
  });

  it('18: id_format_invalid when fieldDef key violates /^f[1-9][0-9]*$/', () => {
    const logic = clone();
    const f1 = logic.fieldDefs.f1;
    if (!f1) throw new Error('f1 missing');
    delete logic.fieldDefs.f1;
    logic.fieldDefs.foo = { ...f1, id: 'foo' };
    expectError(validateLogicForSave(logic), 'id_format_invalid');
  });

  it('collects multiple errors in one pass', () => {
    const logic = clone();
    logic.entryTableId = 't99';
    const t1 = logic.tables.t1;
    if (!t1) throw new Error('t1 missing');
    t1.outputCols = [];
    const res = validateLogicForSave(logic);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const codes = res.errors.map((e) => e.code);
    expect(codes).toContain('entry_table_missing');
    expect(codes).toContain('output_cols_empty');
  });
});
