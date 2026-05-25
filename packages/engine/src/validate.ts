// Logic JSON integrity validator. Twin of LogicSchema (Zod shape check) —
// validateLogicForSave checks the cross-reference integrity that Zod cannot
// express: that entryTableId points at a real table, that continue.tableId
// targets exist, that ID prefixes match the maps that hold them, that counters
// strictly exceed the largest ID suffix in use, that continue graphs are
// acyclic, and so on.
//
// Spec: design_p3_schema.md §7. Eighteen checks total, all collected (the
// validator returns every error it finds, not just the first one). The result
// powers a single error format that every save path consumes — editor export,
// editor import, localStorage repair, MCP load, cloud draft save, and cloud
// publish (§7.5).

import { LogicSchema } from './io.js';
import type { FieldType, Logic, Operator } from './types/logic.js';

export type LogicValidationError = {
  code: string;
  path: (string | number)[];
  message: string;
};

export type LogicValidationResult =
  | { ok: true; logic: Logic }
  | { ok: false; errors: LogicValidationError[] };

// Operator → field-type compatibility (check 11). Derived from how
// evaluate.ts dispatches on op / fieldType.
const OPS_BY_TYPE: Record<FieldType, ReadonlySet<Operator>> = {
  number: new Set<Operator>([
    '=',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'between',
    'in',
    'null',
  ]),
  string: new Set<Operator>([
    '=',
    '!=',
    'contains',
    'starts_with',
    'ends_with',
    'in',
    'null',
  ]),
  bool: new Set<Operator>(['=', '!=', 'null']),
  enum: new Set<Operator>(['=', '!=', 'in', 'null']),
  date: new Set<Operator>([
    '=',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'between',
    'before_today',
    'today_or_before',
    'after_today',
    'today_or_after',
    'null',
  ]),
  datetime: new Set<Operator>([
    '=',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'between',
    'before_today',
    'today_or_before',
    'after_today',
    'today_or_after',
    'null',
  ]),
};

const FIELD_ID_PATTERN = /^f[1-9][0-9]*$/;
const TABLE_ID_PATTERN = /^t[1-9][0-9]*$/;
const COL_ID_PATTERN = /^c[1-9][0-9]*$/;
const OUTPUT_COL_ID_PATTERN = /^oc[1-9][0-9]*$/;
const ROW_ID_PATTERN = /^r[1-9][0-9]*$/;

function suffixOf(prefix: string, id: string): number {
  return Number.parseInt(id.slice(prefix.length), 10);
}

// Object.hasOwn is ES2022; engine still targets ES2020 lib so call the
// prototype form directly. Bumping lib to ES2022 would force the same on
// every downstream package (checks / schema / editor / api / ui-runtime),
// which is out of scope for this change.
function hasOwn(obj: object, key: string): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: ES2020 lib (see above)
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function validateLogicForSave(data: unknown): LogicValidationResult {
  // Phase 1 — shape (Zod). A shape failure is reported as a single error so
  // callers don't have to handle a thrown exception path.
  const parsed = LogicSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      errors: [
        {
          code: 'shape_invalid',
          path: first?.path ?? [],
          message:
            first?.message ?? 'Logic JSON shape does not match LogicSchema',
        },
      ],
    };
  }

  // Phase 2 — integrity. Each check accumulates errors; we return them all.
  const logic = parsed.data as Logic;
  const errors: LogicValidationError[] = [];

  // Check 18 — ID format (run early so later checks can rely on `k === v.id`).
  for (const [k, v] of Object.entries(logic.fieldDefs)) {
    if (!FIELD_ID_PATTERN.test(k)) {
      errors.push({
        code: 'id_format_invalid',
        path: ['fieldDefs', k],
        message: `fieldDefs key '${k}' must match /^f[1-9][0-9]*$/`,
      });
    }
    if (v.id !== k) {
      errors.push({
        code: 'id_key_mismatch',
        path: ['fieldDefs', k, 'id'],
        message: `fieldDefs['${k}'].id is '${v.id}', expected '${k}'`,
      });
    }
  }
  for (const [k, table] of Object.entries(logic.tables)) {
    if (!TABLE_ID_PATTERN.test(k)) {
      errors.push({
        code: 'id_format_invalid',
        path: ['tables', k],
        message: `tables key '${k}' must match /^t[1-9][0-9]*$/`,
      });
    }
    if (table.id !== k) {
      errors.push({
        code: 'id_key_mismatch',
        path: ['tables', k, 'id'],
        message: `tables['${k}'].id is '${table.id}', expected '${k}'`,
      });
    }
    table.cols.forEach((col, i) => {
      if (!COL_ID_PATTERN.test(col.id)) {
        errors.push({
          code: 'id_format_invalid',
          path: ['tables', k, 'cols', i, 'id'],
          message: `col id '${col.id}' must match /^c[1-9][0-9]*$/`,
        });
      }
    });
    table.outputCols.forEach((oc, i) => {
      if (!OUTPUT_COL_ID_PATTERN.test(oc.id)) {
        errors.push({
          code: 'id_format_invalid',
          path: ['tables', k, 'outputCols', i, 'id'],
          message: `outputCol id '${oc.id}' must match /^oc[1-9][0-9]*$/`,
        });
      }
    });
    table.rows.forEach((row, i) => {
      if (!ROW_ID_PATTERN.test(row.id)) {
        errors.push({
          code: 'id_format_invalid',
          path: ['tables', k, 'rows', i, 'id'],
          message: `row id '${row.id}' must match /^r[1-9][0-9]*$/`,
        });
      }
      // ID key check for row.cells keys (must match COL or be a col id from this table)
      for (const cellKey of Object.keys(row.cells)) {
        if (!COL_ID_PATTERN.test(cellKey)) {
          errors.push({
            code: 'id_format_invalid',
            path: ['tables', k, 'rows', i, 'cells', cellKey],
            message: `row.cells key '${cellKey}' must match /^c[1-9][0-9]*$/`,
          });
        }
      }
    });
  }

  // Check 17 — counters are positive integers.
  for (const counterName of [
    'nField',
    'nTable',
    'nCol',
    'nOCol',
    'nRow',
  ] as const) {
    const n = logic[counterName];
    if (!Number.isInteger(n) || n < 1) {
      errors.push({
        code: 'counter_format_invalid',
        path: [counterName],
        message: `${counterName} must be a positive integer (got ${String(n)})`,
      });
    }
  }

  // Check 1 — entryTableId exists.
  if (!hasOwn(logic.tables, logic.entryTableId)) {
    errors.push({
      code: 'entry_table_missing',
      path: ['entryTableId'],
      message: `entryTableId '${logic.entryTableId}' is not in tables`,
    });
  }

  // Check 6 — fieldDefs names are unique.
  const fieldNameSeen = new Map<string, string>();
  for (const [k, v] of Object.entries(logic.fieldDefs)) {
    const prior = fieldNameSeen.get(v.name);
    if (prior !== undefined) {
      errors.push({
        code: 'field_name_duplicate',
        path: ['fieldDefs', k, 'name'],
        message: `fieldDefs name '${v.name}' duplicates '${prior}'`,
      });
    } else {
      fieldNameSeen.set(v.name, k);
    }
    // Check 9 — enum field has at least one enumValue.
    if (v.type === 'enum' && (!v.enumValues || v.enumValues.length === 0)) {
      errors.push({
        code: 'enum_values_empty',
        path: ['fieldDefs', k, 'enumValues'],
        message: `enum field '${v.name}' has no enumValues`,
      });
    }
  }

  // Check 7 — table names are unique.
  const tableNameSeen = new Map<string, string>();
  for (const [k, table] of Object.entries(logic.tables)) {
    const prior = tableNameSeen.get(table.name);
    if (prior !== undefined) {
      errors.push({
        code: 'table_name_duplicate',
        path: ['tables', k, 'name'],
        message: `tables name '${table.name}' duplicates '${prior}'`,
      });
    } else {
      tableNameSeen.set(table.name, k);
    }
  }

  // Per-table checks (3 / 4 / 5 / 8 / 10 / 11 / 12 / 13).
  for (const [tk, table] of Object.entries(logic.tables)) {
    const colIds = new Set(table.cols.map((c) => c.id));
    const outputColIds = new Set(table.outputCols.map((oc) => oc.id));

    // Check 13 — outputCols >= 1.
    if (table.outputCols.length === 0) {
      errors.push({
        code: 'output_cols_empty',
        path: ['tables', tk, 'outputCols'],
        message: `table '${table.name}' has no outputCols`,
      });
    }

    // Check 8 — outputCols names unique within table.
    const outputNameSeen = new Map<string, string>();
    table.outputCols.forEach((oc, i) => {
      const prior = outputNameSeen.get(oc.name);
      if (prior !== undefined) {
        errors.push({
          code: 'output_col_name_duplicate_in_table',
          path: ['tables', tk, 'outputCols', i, 'name'],
          message: `outputCol name '${oc.name}' duplicates '${prior}' in table '${table.name}'`,
        });
      } else {
        outputNameSeen.set(oc.name, oc.id);
      }
    });

    // Check 3 — col.fieldId is null OR exists in fieldDefs.
    table.cols.forEach((col, i) => {
      if (col.fieldId !== null && !hasOwn(logic.fieldDefs, col.fieldId)) {
        errors.push({
          code: 'col_field_missing',
          path: ['tables', tk, 'cols', i, 'fieldId'],
          message: `col fieldId '${col.fieldId}' is not in fieldDefs`,
        });
      }
    });

    // Check 4 — row.cells keys exist in this table's cols.
    // Check 11 — cell.op is valid for the col's field type.
    // Check 12 — cell.val shape matches the op (between/in arrays, others string).
    table.rows.forEach((row, ri) => {
      for (const [cellKey, cell] of Object.entries(row.cells)) {
        if (!colIds.has(cellKey)) {
          errors.push({
            code: 'row_cell_col_missing',
            path: ['tables', tk, 'rows', ri, 'cells', cellKey],
            message: `row cell key '${cellKey}' is not a col of table '${table.name}'`,
          });
          continue;
        }
        const col = table.cols.find((c) => c.id === cellKey);
        const field = col?.fieldId
          ? (logic.fieldDefs[col.fieldId] ?? null)
          : null;

        if (field) {
          const allowed = OPS_BY_TYPE[field.type];
          if (!allowed.has(cell.op)) {
            errors.push({
              code: 'operator_type_mismatch',
              path: ['tables', tk, 'rows', ri, 'cells', cellKey, 'op'],
              message: `operator '${cell.op}' is not valid for field '${field.name}' (type ${field.type})`,
            });
          }
          // Check 10 — enum cell val is in enumValues.
          if (
            field.type === 'enum' &&
            field.enumValues &&
            (cell.op === '=' || cell.op === '!=' || cell.op === 'in')
          ) {
            const vals = Array.isArray(cell.val)
              ? cell.val
              : cell.val == null
                ? []
                : [cell.val];
            for (const v of vals) {
              if (!field.enumValues.includes(v)) {
                errors.push({
                  code: 'enum_value_invalid',
                  path: ['tables', tk, 'rows', ri, 'cells', cellKey, 'val'],
                  message: `enum value '${v}' is not in enumValues of field '${field.name}'`,
                });
              }
            }
          }
        }

        // Check 12 — val shape matches op.
        if (cell.op === 'between' || cell.op === 'in') {
          if (!Array.isArray(cell.val)) {
            errors.push({
              code: 'operator_value_shape_mismatch',
              path: ['tables', tk, 'rows', ri, 'cells', cellKey, 'val'],
              message: `op '${cell.op}' requires val to be an array`,
            });
          } else if (cell.op === 'between' && cell.val.length !== 2) {
            errors.push({
              code: 'operator_value_shape_mismatch',
              path: ['tables', tk, 'rows', ri, 'cells', cellKey, 'val'],
              message: `op 'between' requires exactly 2 values (got ${cell.val.length})`,
            });
          } else if (cell.op === 'in' && cell.val.length === 0) {
            errors.push({
              code: 'operator_value_shape_mismatch',
              path: ['tables', tk, 'rows', ri, 'cells', cellKey, 'val'],
              message: `op 'in' requires at least 1 value`,
            });
          }
        } else if (cell.op === 'null') {
          // null op: val ignored
        } else {
          if (Array.isArray(cell.val)) {
            errors.push({
              code: 'operator_value_shape_mismatch',
              path: ['tables', tk, 'rows', ri, 'cells', cellKey, 'val'],
              message: `op '${cell.op}' requires val to be a string, not an array`,
            });
          }
          if (
            cell.op !== 'before_today' &&
            cell.op !== 'today_or_before' &&
            cell.op !== 'after_today' &&
            cell.op !== 'today_or_after' &&
            (cell.val === undefined || cell.val === null)
          ) {
            errors.push({
              code: 'operator_value_shape_mismatch',
              path: ['tables', tk, 'rows', ri, 'cells', cellKey, 'val'],
              message: `op '${cell.op}' requires a val`,
            });
          }
        }
      }

      // Check 5 — terminal.outputs keys exist in this table's outputCols.
      if (row.conclusion.type === 'terminal') {
        for (const outKey of Object.keys(row.conclusion.outputs)) {
          if (!outputColIds.has(outKey)) {
            errors.push({
              code: 'terminal_output_col_missing',
              path: ['tables', tk, 'rows', ri, 'conclusion', 'outputs', outKey],
              message: `terminal output key '${outKey}' is not an outputCol of table '${table.name}'`,
            });
          }
        }
      }
    });
  }

  // Check 2 — every continue.tableId targets an existing table.
  // Check 15 — continue graph has no cycle (DFS).
  const continueAdj = new Map<string, Set<string>>();
  for (const [tk, table] of Object.entries(logic.tables)) {
    const targets = new Set<string>();
    table.rows.forEach((row, ri) => {
      if (row.conclusion.type === 'continue') {
        const target = row.conclusion.tableId;
        if (!hasOwn(logic.tables, target)) {
          errors.push({
            code: 'continue_target_missing',
            path: ['tables', tk, 'rows', ri, 'conclusion', 'tableId'],
            message: `continue tableId '${target}' is not in tables`,
          });
        } else {
          targets.add(target);
        }
      }
    });
    continueAdj.set(tk, targets);
  }

  // Cycle detection over the continue graph.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const tk of Object.keys(logic.tables)) color.set(tk, WHITE);
  const cycleFrom: string[] = [];

  for (const start of Object.keys(logic.tables)) {
    if (color.get(start) !== WHITE) continue;

    const stack: { node: string; next: string[]; index: number }[] = [
      { node: start, next: Array.from(continueAdj.get(start) ?? []), index: 0 },
    ];
    color.set(start, GRAY);

    while (stack.length > 0 && cycleFrom.length === 0) {
      const frame = stack[stack.length - 1];
      if (!frame) break;

      if (frame.index >= frame.next.length) {
        color.set(frame.node, BLACK);
        stack.pop();
        continue;
      }

      const next = frame.next[frame.index];
      frame.index += 1;
      if (!next) continue;

      if (color.get(next) === GRAY) {
        cycleFrom.push(`${frame.node} → ${next}`);
        break;
      }
      if (color.get(next) === WHITE) {
        color.set(next, GRAY);
        stack.push({
          node: next,
          next: Array.from(continueAdj.get(next) ?? []),
          index: 0,
        });
      }
    }

    if (cycleFrom.length > 0) break;
  }
  if (cycleFrom.length > 0) {
    errors.push({
      code: 'continue_cycle',
      path: ['tables'],
      message: `continue graph has a cycle: ${cycleFrom[0]}`,
    });
  }

  // Check 14 — counters strictly exceed largest ID suffix in use.
  let maxFieldSuffix = 0;
  let maxTableSuffix = 0;
  let maxColSuffix = 0;
  let maxOutputColSuffix = 0;
  let maxRowSuffix = 0;
  for (const k of Object.keys(logic.fieldDefs)) {
    if (FIELD_ID_PATTERN.test(k)) {
      maxFieldSuffix = Math.max(maxFieldSuffix, suffixOf('f', k));
    }
  }
  for (const [k, table] of Object.entries(logic.tables)) {
    if (TABLE_ID_PATTERN.test(k)) {
      maxTableSuffix = Math.max(maxTableSuffix, suffixOf('t', k));
    }
    for (const col of table.cols) {
      if (COL_ID_PATTERN.test(col.id)) {
        maxColSuffix = Math.max(maxColSuffix, suffixOf('c', col.id));
      }
    }
    for (const oc of table.outputCols) {
      if (OUTPUT_COL_ID_PATTERN.test(oc.id)) {
        maxOutputColSuffix = Math.max(
          maxOutputColSuffix,
          suffixOf('oc', oc.id),
        );
      }
    }
    for (const row of table.rows) {
      if (ROW_ID_PATTERN.test(row.id)) {
        maxRowSuffix = Math.max(maxRowSuffix, suffixOf('r', row.id));
      }
    }
  }
  if (logic.nField <= maxFieldSuffix) {
    errors.push({
      code: 'counter_inconsistent',
      path: ['nField'],
      message: `nField (${logic.nField}) must be > max field suffix (${maxFieldSuffix})`,
    });
  }
  if (logic.nTable <= maxTableSuffix) {
    errors.push({
      code: 'counter_inconsistent',
      path: ['nTable'],
      message: `nTable (${logic.nTable}) must be > max table suffix (${maxTableSuffix})`,
    });
  }
  if (logic.nCol <= maxColSuffix) {
    errors.push({
      code: 'counter_inconsistent',
      path: ['nCol'],
      message: `nCol (${logic.nCol}) must be > max col suffix (${maxColSuffix})`,
    });
  }
  if (logic.nOCol <= maxOutputColSuffix) {
    errors.push({
      code: 'counter_inconsistent',
      path: ['nOCol'],
      message: `nOCol (${logic.nOCol}) must be > max outputCol suffix (${maxOutputColSuffix})`,
    });
  }
  if (logic.nRow <= maxRowSuffix) {
    errors.push({
      code: 'counter_inconsistent',
      path: ['nRow'],
      message: `nRow (${logic.nRow}) must be > max row suffix (${maxRowSuffix})`,
    });
  }

  return errors.length === 0 ? { ok: true, logic } : { ok: false, errors };
}
