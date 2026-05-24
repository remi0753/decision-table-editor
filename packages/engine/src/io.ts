import { z } from 'zod';

const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CELL_VALUE_LENGTH = 1000;
const MAX_FIELDS = 200;
const MAX_TABLES = 100;
const MAX_COLS_PER_TABLE = 100;
const MAX_OUTPUT_COLS_PER_TABLE = 50;
const MAX_ROWS_PER_TABLE = 1000;
const MAX_ENUM_VALUES = 500;
const MAX_CELLS_PER_ROW = 100;
const MAX_OUTPUTS_PER_ROW = 50;

function boundedRecord<T extends z.ZodTypeAny>(
  valueSchema: T,
  maxKeys: number,
) {
  return z.record(valueSchema).superRefine((value, ctx) => {
    const keys = Object.keys(value);
    if (keys.length > maxKeys) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected at most ${maxKeys} entries`,
      });
    }
  });
}

const CellSchema = z.object({
  op: z.string().max(MAX_NAME_LENGTH),
  val: z
    .union([
      z.string().max(MAX_CELL_VALUE_LENGTH),
      z.array(z.string().max(MAX_CELL_VALUE_LENGTH)).max(MAX_ENUM_VALUES),
    ])
    .optional(),
});

const TerminalConclusionSchema = z.object({
  type: z.literal('terminal'),
  outputs: boundedRecord(
    z.string().max(MAX_CELL_VALUE_LENGTH),
    MAX_OUTPUTS_PER_ROW,
  ),
});

const ContinueConclusionSchema = z.object({
  type: z.literal('continue'),
  tableId: z.string().max(MAX_ID_LENGTH),
});

const RowSchema = z.object({
  id: z.string().max(MAX_ID_LENGTH),
  cells: boundedRecord(CellSchema, MAX_CELLS_PER_ROW),
  conclusion: z.union([TerminalConclusionSchema, ContinueConclusionSchema]),
});

const TableSchema = z.object({
  id: z.string().max(MAX_ID_LENGTH),
  name: z.string().max(MAX_NAME_LENGTH),
  cols: z
    .array(
      z.object({
        id: z.string().max(MAX_ID_LENGTH),
        fieldId: z.string().max(MAX_ID_LENGTH).nullable(),
      }),
    )
    .max(MAX_COLS_PER_TABLE),
  outputCols: z
    .array(
      z.object({
        id: z.string().max(MAX_ID_LENGTH),
        name: z.string().max(MAX_NAME_LENGTH),
      }),
    )
    .max(MAX_OUTPUT_COLS_PER_TABLE),
  rows: z.array(RowSchema).max(MAX_ROWS_PER_TABLE),
});

const FieldDefSchema = z.object({
  id: z.string().max(MAX_ID_LENGTH),
  name: z.string().max(MAX_NAME_LENGTH),
  type: z.enum(['number', 'string', 'bool', 'enum', 'date', 'datetime']),
  enumValues: z
    .array(z.string().max(MAX_CELL_VALUE_LENGTH))
    .max(MAX_ENUM_VALUES)
    .optional(),
});

export const FieldDefsFileSchema = z.object({
  version: z.literal('1'),
  fields: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(['number', 'string', 'bool', 'enum', 'date', 'datetime']),
        enumValues: z
          .array(z.string().max(MAX_CELL_VALUE_LENGTH))
          .max(MAX_ENUM_VALUES)
          .optional(),
      }),
    )
    .max(MAX_FIELDS),
});

export const LogicSchema = z.object({
  version: z.literal('2'),
  name: z.string().max(MAX_NAME_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  entryTableId: z.string().max(MAX_ID_LENGTH),
  fieldDefs: boundedRecord(FieldDefSchema, MAX_FIELDS),
  tables: boundedRecord(TableSchema, MAX_TABLES),
  nField: z.number(),
  nTable: z.number(),
  nCol: z.number(),
  nOCol: z.number(),
  nRow: z.number(),
});
