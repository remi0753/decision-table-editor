import type { Cell, Conclusion, FieldType, Logic } from '@leverie/engine';
import { create } from 'zustand';
import { getT } from '@/i18n/useT';
import {
  nextColId,
  nextFieldId,
  nextOColId,
  nextRowId,
  nextTableId,
} from '@/lib/idgen';

export const createInitialLogic = (): Logic => {
  const t = getT();
  return {
    version: '2',
    name: t.initialLogicName,
    entryTableId: 't1',
    fieldDefs: {},
    tables: {
      t1: {
        id: 't1',
        name: t.initialTableName(1),
        cols: [],
        outputCols: [{ id: 'oc1', name: t.initialOutputColName }],
        rows: [],
      },
    },
    nField: 1,
    nTable: 2,
    nCol: 1,
    nOCol: 2,
    nRow: 1,
  };
};

interface LogicStore {
  logic: Logic;

  setLogicName: (name: string) => void;
  setLogicDescription: (desc: string) => void;
  setEntryTable: (tableId: string) => void;
  importLogic: (logic: Logic) => void;
  resetLogic: () => void;

  addTable: () => string;
  deleteTable: (tableId: string) => { error?: string };
  renameTable: (tableId: string, name: string) => { error?: string };

  addField: (
    name: string,
    type: FieldType,
    enumValues?: string[],
  ) => { error?: string };
  importFieldDefs: (
    fields: { name: string; type: FieldType; enumValues?: string[] }[],
  ) => { added: number; skipped: string[] };
  renameField: (fieldId: string, name: string) => { error?: string };
  changeFieldType: (fieldId: string, type: FieldType) => void;
  deleteField: (fieldId: string) => { error?: string };
  addEnumValue: (fieldId: string, value: string) => void;
  renameEnumValue: (
    fieldId: string,
    oldValue: string,
    newValue: string,
  ) => void;
  deleteEnumValue: (
    fieldId: string,
    value: string,
  ) => { error?: string; usedIn?: string[] };

  addCol: (tableId: string) => void;
  deleteCol: (tableId: string, colId: string) => void;
  setColField: (tableId: string, colId: string, fieldId: string | null) => void;

  addOutputCol: (tableId: string, name: string) => void;
  renameOutputCol: (tableId: string, ocolId: string, name: string) => void;
  deleteOutputCol: (tableId: string, ocolId: string) => { error?: string };

  addRow: (tableId: string) => string | undefined;
  insertRowAfter: (tableId: string, rowId: string) => string | undefined;
  duplicateRow: (tableId: string, rowId: string) => string | undefined;
  deleteRow: (tableId: string, rowId: string) => void;
  deleteAllRows: (tableId: string) => void;
  moveRow: (tableId: string, fromIndex: number, toIndex: number) => void;
  moveCol: (tableId: string, fromIndex: number, toIndex: number) => void;

  setCell: (tableId: string, rowId: string, colId: string, cell: Cell) => void;
  clearCell: (tableId: string, rowId: string, colId: string) => void;

  setConclusion: (
    tableId: string,
    rowId: string,
    conclusion: Conclusion,
  ) => void;
}

export const useLogicStore = create<LogicStore>((set, get) => ({
  logic: createInitialLogic(),

  setLogicName: (name) => set((s) => ({ logic: { ...s.logic, name } })),
  setLogicDescription: (description) =>
    set((s) => ({ logic: { ...s.logic, description } })),
  setEntryTable: (entryTableId) =>
    set((s) => ({ logic: { ...s.logic, entryTableId } })),
  importLogic: (logic) => set({ logic }),
  resetLogic: () => set({ logic: createInitialLogic() }),

  addTable: () => {
    const t = getT();
    const id = nextTableId(get().logic.nTable);
    set((s) => {
      const ocolId = nextOColId(s.logic.nOCol);
      const name = t.initialTableName(s.logic.nTable);
      return {
        logic: {
          ...s.logic,
          nTable: s.logic.nTable + 1,
          nOCol: s.logic.nOCol + 1,
          tables: {
            ...s.logic.tables,
            [id]: {
              id,
              name,
              cols: [],
              outputCols: [{ id: ocolId, name: t.initialOutputColName }],
              rows: [],
            },
          },
        },
      };
    });
    return id;
  },

  deleteTable: (tableId) => {
    const { logic } = get();
    const t = getT();
    if (Object.keys(logic.tables).length <= 1) {
      return { error: t.errMinOneTable };
    }
    if (logic.entryTableId === tableId) {
      return { error: t.errCannotDeleteEntry };
    }
    const referencedBy: string[] = [];
    for (const [tid, table] of Object.entries(logic.tables)) {
      if (tid === tableId) continue;
      for (const row of table.rows) {
        if (
          row.conclusion.type === 'continue' &&
          row.conclusion.tableId === tableId
        ) {
          referencedBy.push(table.name);
          break;
        }
      }
    }
    if (referencedBy.length > 0) {
      return { error: t.errTableReferenced(referencedBy.join('、')) };
    }
    set((s) => {
      const { [tableId]: _, ...rest } = s.logic.tables;
      return { logic: { ...s.logic, tables: rest } };
    });
    return {};
  },

  renameTable: (tableId, name) => {
    const { logic } = get();
    const t = getT();
    const duplicate = Object.values(logic.tables).some(
      (tb) => tb.name === name && tb.id !== tableId,
    );
    if (duplicate) return { error: t.errTableNameDuplicate(name) };
    set((s) => ({
      logic: {
        ...s.logic,
        tables: {
          ...s.logic.tables,
          [tableId]: { ...s.logic.tables[tableId]!, name },
        },
      },
    }));
    return {};
  },

  addField: (name, type, enumValues) => {
    const { logic } = get();
    const t = getT();
    const duplicate = Object.values(logic.fieldDefs).some(
      (f) => f.name === name,
    );
    if (duplicate) return { error: t.errFieldNameDuplicate(name) };
    const id = nextFieldId(logic.nField);
    set((s) => ({
      logic: {
        ...s.logic,
        nField: s.logic.nField + 1,
        fieldDefs: {
          ...s.logic.fieldDefs,
          [id]: { id, name, type, ...(enumValues ? { enumValues } : {}) },
        },
      },
    }));
    return {};
  },

  importFieldDefs: (fields) => {
    const { logic } = get();
    const existingNames = new Set(
      Object.values(logic.fieldDefs).map((f) => f.name),
    );
    const skipped: string[] = [];
    const toAdd: { name: string; type: FieldType; enumValues?: string[] }[] =
      [];
    const seenInBatch = new Set<string>();
    for (const f of fields) {
      if (existingNames.has(f.name) || seenInBatch.has(f.name)) {
        skipped.push(f.name);
        continue;
      }
      seenInBatch.add(f.name);
      toAdd.push(f);
    }
    if (toAdd.length === 0) return { added: 0, skipped };
    set((s) => {
      const newFieldDefs = { ...s.logic.fieldDefs };
      let n = s.logic.nField;
      for (const f of toAdd) {
        const id = nextFieldId(n);
        newFieldDefs[id] = {
          id,
          name: f.name,
          type: f.type,
          ...(f.type === 'enum'
            ? { enumValues: f.enumValues ?? [] }
            : f.enumValues
              ? { enumValues: f.enumValues }
              : {}),
        };
        n++;
      }
      return {
        logic: { ...s.logic, fieldDefs: newFieldDefs, nField: n },
      };
    });
    return { added: toAdd.length, skipped };
  },

  renameField: (fieldId, name) => {
    const { logic } = get();
    const t = getT();
    const duplicate = Object.values(logic.fieldDefs).some(
      (f) => f.name === name && f.id !== fieldId,
    );
    if (duplicate) return { error: t.errFieldNameDuplicate(name) };
    set((s) => ({
      logic: {
        ...s.logic,
        fieldDefs: {
          ...s.logic.fieldDefs,
          [fieldId]: { ...s.logic.fieldDefs[fieldId]!, name },
        },
      },
    }));
    return {};
  },

  changeFieldType: (fieldId, type) =>
    set((s) => {
      const newTables = { ...s.logic.tables };
      for (const [tid, table] of Object.entries(newTables)) {
        const affectedCols = table.cols.filter((c) => c.fieldId === fieldId);
        if (affectedCols.length === 0) continue;
        const colIds = new Set(affectedCols.map((c) => c.id));
        const newRows = table.rows.map((row) => {
          const newCells = { ...row.cells };
          for (const colId of colIds) delete newCells[colId];
          return { ...row, cells: newCells };
        });
        newTables[tid] = { ...table, rows: newRows };
      }
      return {
        logic: {
          ...s.logic,
          fieldDefs: {
            ...s.logic.fieldDefs,
            [fieldId]: { ...s.logic.fieldDefs[fieldId]!, type },
          },
          tables: newTables,
        },
      };
    }),

  deleteField: (fieldId) => {
    const { logic } = get();
    const t = getT();
    const usedIn: string[] = [];
    for (const table of Object.values(logic.tables)) {
      for (const col of table.cols) {
        if (col.fieldId === fieldId) {
          usedIn.push(table.name);
          break;
        }
      }
    }
    if (usedIn.length > 0) {
      const field = logic.fieldDefs[fieldId];
      return {
        error: t.errFieldInUse(field?.name ?? fieldId, usedIn.join('、')),
      };
    }
    set((s) => {
      const { [fieldId]: _, ...rest } = s.logic.fieldDefs;
      return { logic: { ...s.logic, fieldDefs: rest } };
    });
    return {};
  },

  addEnumValue: (fieldId, value) =>
    set((s) => {
      const field = s.logic.fieldDefs[fieldId];
      if (!field) return s;
      return {
        logic: {
          ...s.logic,
          fieldDefs: {
            ...s.logic.fieldDefs,
            [fieldId]: {
              ...field,
              enumValues: [...(field.enumValues ?? []), value],
            },
          },
        },
      };
    }),

  renameEnumValue: (fieldId, oldValue, newValue) =>
    set((s) => {
      const field = s.logic.fieldDefs[fieldId];
      if (!field) return s;
      const newEnumValues = (field.enumValues ?? []).map((v) =>
        v === oldValue ? newValue : v,
      );
      const newTables = { ...s.logic.tables };
      for (const [tid, table] of Object.entries(newTables)) {
        const affectedCols = table.cols.filter((c) => c.fieldId === fieldId);
        if (affectedCols.length === 0) continue;
        const colIds = new Set(affectedCols.map((c) => c.id));
        const newRows = table.rows.map((row) => {
          const newCells = { ...row.cells };
          for (const colId of colIds) {
            const cell = newCells[colId];
            if (!cell) continue;
            if (cell.op === '=' && cell.val === oldValue) {
              newCells[colId] = { ...cell, val: newValue };
            } else if (cell.op === '!=' && cell.val === oldValue) {
              newCells[colId] = { ...cell, val: newValue };
            } else if (cell.op === 'in' && Array.isArray(cell.val)) {
              newCells[colId] = {
                ...cell,
                val: cell.val.map((v) => (v === oldValue ? newValue : v)),
              };
            }
          }
          return { ...row, cells: newCells };
        });
        newTables[tid] = { ...table, rows: newRows };
      }
      return {
        logic: {
          ...s.logic,
          fieldDefs: {
            ...s.logic.fieldDefs,
            [fieldId]: { ...field, enumValues: newEnumValues },
          },
          tables: newTables,
        },
      };
    }),

  deleteEnumValue: (fieldId, value) => {
    const { logic } = get();
    const t = getT();
    const usedIn: string[] = [];
    for (const table of Object.values(logic.tables)) {
      for (const col of table.cols) {
        if (col.fieldId !== fieldId) continue;
        for (const row of table.rows) {
          const cell = row.cells[col.id];
          if (!cell) continue;
          if ((cell.op === '=' || cell.op === '!=') && cell.val === value)
            usedIn.push(table.name);
          if (
            cell.op === 'in' &&
            Array.isArray(cell.val) &&
            cell.val.includes(value)
          )
            usedIn.push(table.name);
        }
      }
    }
    if (usedIn.length > 0) {
      return { error: t.errEnumValueInUse(value), usedIn };
    }
    set((s) => {
      const field = s.logic.fieldDefs[fieldId];
      if (!field) return s;
      return {
        logic: {
          ...s.logic,
          fieldDefs: {
            ...s.logic.fieldDefs,
            [fieldId]: {
              ...field,
              enumValues: (field.enumValues ?? []).filter((v) => v !== value),
            },
          },
        },
      };
    });
    return {};
  },

  addCol: (tableId) =>
    set((s) => {
      const id = nextColId(s.logic.nCol);
      const table = s.logic.tables[tableId];
      if (!table) return s;
      return {
        logic: {
          ...s.logic,
          nCol: s.logic.nCol + 1,
          tables: {
            ...s.logic.tables,
            [tableId]: {
              ...table,
              cols: [...table.cols, { id, fieldId: null }],
            },
          },
        },
      };
    }),

  deleteCol: (tableId, colId) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const newCols = table.cols.filter((c) => c.id !== colId);
      const newRows = table.rows.map((row) => {
        const { [colId]: _, ...restCells } = row.cells;
        return { ...row, cells: restCells };
      });
      return {
        logic: {
          ...s.logic,
          tables: {
            ...s.logic.tables,
            [tableId]: { ...table, cols: newCols, rows: newRows },
          },
        },
      };
    }),

  setColField: (tableId, colId, fieldId) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const newCols = table.cols.map((c) =>
        c.id === colId ? { ...c, fieldId } : c,
      );
      const newRows = table.rows.map((row) => {
        const { [colId]: _, ...restCells } = row.cells;
        return { ...row, cells: restCells };
      });
      return {
        logic: {
          ...s.logic,
          tables: {
            ...s.logic.tables,
            [tableId]: { ...table, cols: newCols, rows: newRows },
          },
        },
      };
    }),

  addOutputCol: (tableId, name) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const id = nextOColId(s.logic.nOCol);
      return {
        logic: {
          ...s.logic,
          nOCol: s.logic.nOCol + 1,
          tables: {
            ...s.logic.tables,
            [tableId]: {
              ...table,
              outputCols: [...table.outputCols, { id, name }],
            },
          },
        },
      };
    }),

  renameOutputCol: (tableId, ocolId, name) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      return {
        logic: {
          ...s.logic,
          tables: {
            ...s.logic.tables,
            [tableId]: {
              ...table,
              outputCols: table.outputCols.map((oc) =>
                oc.id === ocolId ? { ...oc, name } : oc,
              ),
            },
          },
        },
      };
    }),

  deleteOutputCol: (tableId, ocolId) => {
    const { logic } = get();
    const t = getT();
    const table = logic.tables[tableId];
    if (!table) return { error: t.errTableNotFound };
    if (table.outputCols.length <= 1) {
      return { error: t.errMinOneOutputCol };
    }
    set((s) => {
      const tb = s.logic.tables[tableId]!;
      const newOutputCols = tb.outputCols.filter((oc) => oc.id !== ocolId);
      const newRows = tb.rows.map((row) => {
        if (row.conclusion.type !== 'terminal') return row;
        const { [ocolId]: _, ...restOutputs } = row.conclusion.outputs;
        return {
          ...row,
          conclusion: { ...row.conclusion, outputs: restOutputs },
        };
      });
      return {
        logic: {
          ...s.logic,
          tables: {
            ...s.logic.tables,
            [tableId]: { ...tb, outputCols: newOutputCols, rows: newRows },
          },
        },
      };
    });
    return {};
  },

  addRow: (tableId) => {
    const { logic } = get();
    if (!logic.tables[tableId]) return undefined;
    const id = nextRowId(logic.nRow);
    const newRow = {
      id,
      cells: {},
      conclusion: { type: 'terminal' as const, outputs: {} },
    };
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      return {
        logic: {
          ...s.logic,
          nRow: s.logic.nRow + 1,
          tables: {
            ...s.logic.tables,
            [tableId]: { ...table, rows: [...table.rows, newRow] },
          },
        },
      };
    });
    return id;
  },

  insertRowAfter: (tableId, rowId) => {
    const { logic } = get();
    const table = logic.tables[tableId];
    if (!table) return undefined;
    const idx = table.rows.findIndex((r) => r.id === rowId);
    if (idx === -1) return undefined;
    const id = nextRowId(logic.nRow);
    const newRow = {
      id,
      cells: {},
      conclusion: { type: 'terminal' as const, outputs: {} },
    };
    set((s) => {
      const tb = s.logic.tables[tableId];
      if (!tb) return s;
      const sourceIdx = tb.rows.findIndex((r) => r.id === rowId);
      if (sourceIdx === -1) return s;
      const newRows = [...tb.rows];
      newRows.splice(sourceIdx + 1, 0, newRow);
      return {
        logic: {
          ...s.logic,
          nRow: s.logic.nRow + 1,
          tables: {
            ...s.logic.tables,
            [tableId]: { ...tb, rows: newRows },
          },
        },
      };
    });
    return id;
  },

  duplicateRow: (tableId, rowId) => {
    const { logic } = get();
    const table = logic.tables[tableId];
    if (!table) return undefined;
    const sourceIndex = table.rows.findIndex((r) => r.id === rowId);
    if (sourceIndex === -1) return undefined;
    const source = table.rows[sourceIndex]!;
    const newId = nextRowId(logic.nRow);
    const clonedCells: Record<string, Cell> = {};
    for (const [colId, cell] of Object.entries(source.cells)) {
      clonedCells[colId] = {
        op: cell.op,
        ...(Array.isArray(cell.val)
          ? { val: [...cell.val] }
          : cell.val !== undefined
            ? { val: cell.val }
            : {}),
      };
    }
    const clonedConclusion: Conclusion =
      source.conclusion.type === 'terminal'
        ? { type: 'terminal', outputs: { ...source.conclusion.outputs } }
        : { type: 'continue', tableId: source.conclusion.tableId };
    const newRow = {
      id: newId,
      cells: clonedCells,
      conclusion: clonedConclusion,
    };
    set((s) => {
      const tb = s.logic.tables[tableId];
      if (!tb) return s;
      const idx = tb.rows.findIndex((r) => r.id === rowId);
      if (idx === -1) return s;
      const newRows = [...tb.rows];
      newRows.splice(idx + 1, 0, newRow);
      return {
        logic: {
          ...s.logic,
          nRow: s.logic.nRow + 1,
          tables: {
            ...s.logic.tables,
            [tableId]: { ...tb, rows: newRows },
          },
        },
      };
    });
    return newId;
  },

  deleteRow: (tableId, rowId) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      return {
        logic: {
          ...s.logic,
          tables: {
            ...s.logic.tables,
            [tableId]: {
              ...table,
              rows: table.rows.filter((r) => r.id !== rowId),
            },
          },
        },
      };
    }),

  deleteAllRows: (tableId) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table || table.rows.length === 0) return s;
      return {
        logic: {
          ...s.logic,
          tables: {
            ...s.logic.tables,
            [tableId]: { ...table, rows: [] },
          },
        },
      };
    }),

  moveRow: (tableId, fromIndex, toIndex) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const rows = [...table.rows];
      const [moved] = rows.splice(fromIndex, 1);
      if (!moved) return s;
      rows.splice(toIndex, 0, moved);
      return {
        logic: {
          ...s.logic,
          tables: { ...s.logic.tables, [tableId]: { ...table, rows } },
        },
      };
    }),

  moveCol: (tableId, fromIndex, toIndex) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const cols = [...table.cols];
      const [moved] = cols.splice(fromIndex, 1);
      if (!moved) return s;
      cols.splice(toIndex, 0, moved);
      return {
        logic: {
          ...s.logic,
          tables: { ...s.logic.tables, [tableId]: { ...table, cols } },
        },
      };
    }),

  setCell: (tableId, rowId, colId, cell) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const newRows = table.rows.map((row) =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [colId]: cell } }
          : row,
      );
      return {
        logic: {
          ...s.logic,
          tables: { ...s.logic.tables, [tableId]: { ...table, rows: newRows } },
        },
      };
    }),

  clearCell: (tableId, rowId, colId) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const newRows = table.rows.map((row) => {
        if (row.id !== rowId) return row;
        const { [colId]: _, ...restCells } = row.cells;
        return { ...row, cells: restCells };
      });
      return {
        logic: {
          ...s.logic,
          tables: { ...s.logic.tables, [tableId]: { ...table, rows: newRows } },
        },
      };
    }),

  setConclusion: (tableId, rowId, conclusion) =>
    set((s) => {
      const table = s.logic.tables[tableId];
      if (!table) return s;
      const newRows = table.rows.map((row) =>
        row.id === rowId ? { ...row, conclusion } : row,
      );
      return {
        logic: {
          ...s.logic,
          tables: { ...s.logic.tables, [tableId]: { ...table, rows: newRows } },
        },
      };
    }),
}));
