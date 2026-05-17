import { z } from 'zod';

const CellSchema = z.object({
  op: z.string(),
  val: z.union([z.string(), z.array(z.string())]).optional(),
});

const TerminalConclusionSchema = z.object({
  type: z.literal('terminal'),
  outputs: z.record(z.string()),
});

const ContinueConclusionSchema = z.object({
  type: z.literal('continue'),
  tableId: z.string(),
});

const RowSchema = z.object({
  id: z.string(),
  cells: z.record(CellSchema),
  conclusion: z.union([TerminalConclusionSchema, ContinueConclusionSchema]),
});

const TableSchema = z.object({
  id: z.string(),
  name: z.string(),
  cols: z.array(z.object({ id: z.string(), fieldId: z.string().nullable() })),
  outputCols: z.array(z.object({ id: z.string(), name: z.string() })),
  rows: z.array(RowSchema),
});

const FieldDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['number', 'string', 'bool', 'enum', 'date', 'datetime']),
  enumValues: z.array(z.string()).optional(),
});

export const FieldDefsFileSchema = z.object({
  version: z.literal('1'),
  fields: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(['number', 'string', 'bool', 'enum', 'date', 'datetime']),
      enumValues: z.array(z.string()).optional(),
    }),
  ),
});

export const LogicSchema = z.object({
  version: z.literal('2'),
  name: z.string(),
  description: z.string().optional(),
  entryTableId: z.string(),
  fieldDefs: z.record(FieldDefSchema),
  tables: z.record(TableSchema),
  nField: z.number(),
  nTable: z.number(),
  nCol: z.number(),
  nOCol: z.number(),
  nRow: z.number(),
});
