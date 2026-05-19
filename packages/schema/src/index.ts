import type { EvalResult, FieldDef, Logic, TraceStep } from '@leverie/engine';
import { evaluateTable } from '@leverie/engine';
import { z } from 'zod';

/**
 * Minimal JSON Schema (draft 2020-12 / 7) subset that LEVERIE produces.
 * Kept hand-rolled to avoid pulling in a JSON Schema typings dependency.
 */
export type JsonSchema = {
  $schema?: string;
  title?: string;
  description?: string;
  type?:
    | 'object'
    | 'array'
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'null';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean | null>;
  const?: string | number | boolean | null;
  format?: string;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
};

function fieldToJsonSchema(field: FieldDef): JsonSchema {
  switch (field.type) {
    case 'number':
      return { type: 'number', description: `Field: ${field.name}` };
    case 'bool':
      return { type: 'boolean', description: `Field: ${field.name}` };
    case 'enum':
      return {
        type: 'string',
        enum: field.enumValues ?? [],
        description: `Field: ${field.name}`,
      };
    case 'date':
      return {
        type: 'string',
        format: 'date',
        description: `Field: ${field.name} (ISO 8601 date, e.g. "2026-05-17")`,
      };
    case 'datetime':
      return {
        type: 'string',
        format: 'date-time',
        description: `Field: ${field.name} (ISO 8601 datetime)`,
      };
    default:
      return { type: 'string', description: `Field: ${field.name}` };
  }
}

/**
 * Build a JSON Schema describing the inputs accepted by this Logic.
 *
 * Each field defined in `logic.fieldDefs` becomes a property keyed by the
 * **field name** (not the internal ID), since LLM-facing schemas should use
 * human-readable identifiers.
 *
 * All fields are optional by default — LEVERIE treats missing inputs as
 * "wildcard" matches against blank cells. Callers that want to require
 * specific inputs can post-process the returned schema.
 */
export function logicToInputSchema(logic: Logic): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const field of Object.values(logic.fieldDefs)) {
    properties[field.name] = fieldToJsonSchema(field);
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: `${logic.name} — Inputs`,
    description:
      logic.description ??
      `Inputs for evaluating the "${logic.name}" decision logic.`,
    type: 'object',
    properties,
    additionalProperties: false,
  };
}

/**
 * Collect the union of output column names across every terminal conclusion
 * in the logic. Since LEVERIE allows different tables to have different
 * output column sets, the output schema describes the **superset** of
 * possible outputs.
 */
function collectAllOutputColumnNames(logic: Logic): string[] {
  const names = new Set<string>();
  for (const table of Object.values(logic.tables)) {
    for (const col of table.outputCols) {
      names.add(col.name);
    }
  }
  return Array.from(names);
}

const TRACE_JSON_SCHEMA: JsonSchema = {
  type: 'array',
  description:
    'Evaluation trace: every table visited, which row matched (1-based), and which rows were skipped and why.',
  items: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name.' },
      depth: {
        type: 'number',
        description: '0-based depth in the continue chain.',
      },
      matchedRow: {
        type: 'object',
        description:
          'Row that matched, or null if every row was skipped at this depth.',
        properties: {
          index: {
            type: 'number',
            description: '1-based row index within the table.',
          },
          conclusion: {
            type: 'string',
            enum: ['terminal', 'continue'],
            description:
              '"terminal" stops evaluation; "continue" chains into nextTable.',
          },
          nextTable: {
            type: 'string',
            description: 'Name of the next table when conclusion="continue".',
          },
        },
        required: ['index', 'conclusion'],
      },
      skippedRows: {
        type: 'array',
        description: 'Rows skipped before the match (or all rows on no_match).',
        items: {
          type: 'object',
          properties: {
            index: {
              type: 'number',
              description: '1-based row index that was skipped.',
            },
            failedField: {
              type: 'string',
              description: 'Field name whose cell did not match.',
            },
          },
          required: ['index', 'failedField'],
        },
      },
    },
    required: ['table', 'depth', 'skippedRows'],
  },
};

/**
 * Build a JSON Schema describing the result of evaluating this Logic.
 *
 * The result is a discriminated union over `status`:
 *
 * - `ok`: a terminal conclusion was reached. `outputs` contains one string
 *   per output column. The list of possible output columns is the union of
 *   `table.outputCols.name` across all tables.
 * - `no_match`: evaluation reached a table with no matching row;
 *   `unmatchedTable` carries the table name.
 *
 * Both branches include a `trace` array shaped by `formatTrace` so LLM clients
 * can show their reasoning to end users.
 */
export function logicToOutputSchema(logic: Logic): JsonSchema {
  const outputNames = collectAllOutputColumnNames(logic);
  const outputProperties: Record<string, JsonSchema> = {};
  for (const name of outputNames) {
    outputProperties[name] = { type: 'string' };
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: `${logic.name} — Result`,
    type: 'object',
    oneOf: [
      {
        title: 'Matched (terminal conclusion reached)',
        type: 'object',
        properties: {
          status: { const: 'ok' },
          outputs: {
            type: 'object',
            properties: outputProperties,
            additionalProperties: false,
          },
          trace: TRACE_JSON_SCHEMA,
        },
        required: ['status', 'outputs', 'trace'],
      },
      {
        title: 'No match (evaluation ended without a matching row)',
        type: 'object',
        properties: {
          status: { const: 'no_match' },
          unmatchedTable: { type: 'string' },
          trace: TRACE_JSON_SCHEMA,
        },
        required: ['status', 'unmatchedTable', 'trace'],
      },
    ],
  };
}

/** Tool-name length cap. Stays well under common MCP-client display limits while
 * leaving room for prefix disambiguation by callers. */
const MAX_TOOL_SLUG_LENGTH = 64;

/**
 * Convert an arbitrary string into an LLM-friendly tool name slug.
 *
 * - Splits camelCase / PascalCase so `"loanReview"` → `"loan_review"` and
 *   `"HTTPServer"` → `"http_server"`.
 * - Lowercases, replaces non-alphanumerics with underscores, collapses repeats
 *   and trims leading/trailing underscores.
 * - Prefixes `tool_` if the result would otherwise start with a digit (MCP
 *   client SDKs often require an identifier-shaped first character).
 * - Caps length at 64 chars.
 * - Falls back to `"logic"` when nothing survives the transformation.
 */
export function logicNameToToolSlug(name: string): string {
  let slug = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!slug) return 'logic';

  if (/^[0-9]/.test(slug)) slug = `tool_${slug}`;

  if (slug.length > MAX_TOOL_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_TOOL_SLUG_LENGTH).replace(/_+$/, '');
  }

  return slug || 'logic';
}

/**
 * Evaluation result whose `outputs` are keyed by **output column name**,
 * matching what `logicToOutputSchema` advertises to LLMs / MCP clients.
 *
 * The internal `@leverie/engine` API keys outputs by generated column IDs
 * (`oc1`, `oc2`, …). `evaluateLogicByName` re-keys them so that the
 * round-trip { JSON-Schema → LLM input → evaluation → JSON-Schema-shaped
 * result } actually closes.
 */
export type EvalResultByName =
  | {
      status: 'ok';
      outputs: Record<string, string>;
      trace: TraceStep[];
    }
  | {
      status: 'no_match';
      tableId: string;
      trace: TraceStep[];
    };

/**
 * Build a lookup from output column id → output column name across every
 * table in the logic. Different tables may legally share an output name —
 * that's the intended union behaviour and matches `logicToOutputSchema`.
 */
function buildOutputIdToName(logic: Logic): Map<string, string> {
  const map = new Map<string, string>();
  for (const table of Object.values(logic.tables)) {
    for (const col of table.outputCols) {
      map.set(col.id, col.name);
    }
  }
  return map;
}

/**
 * Evaluate a Logic using LLM-/MCP-friendly key names on both sides.
 *
 * - Inputs are keyed by **field name** (e.g. `"Customer Type"`), exactly as
 *   `logicToInputSchema` advertises. Internal `fieldId`s never have to leak
 *   into the LLM prompt or the MCP call site.
 * - Outputs are returned keyed by **output column name**, matching
 *   `logicToOutputSchema`'s shape.
 *
 * Callers wiring LEVERIE into an MCP server should reach for this function;
 * `evaluateTable` from `@leverie/engine` remains available for callers that
 * already work in the engine's native id-keyed contract (e.g. the editor).
 */
export function evaluateLogicByName(
  logic: Logic,
  inputsByName: Record<string, string>,
): EvalResultByName {
  const result: EvalResult = evaluateTable(
    logic.entryTableId,
    inputsByName,
    logic,
  );

  if (result.status === 'no_match') {
    return {
      status: 'no_match',
      tableId: result.tableId,
      trace: result.trace,
    };
  }

  const outputIdToName = buildOutputIdToName(logic);
  const outputsByName: Record<string, string> = {};
  for (const [colId, value] of Object.entries(result.outputs)) {
    const name = outputIdToName.get(colId) ?? colId;
    outputsByName[name] = value;
  }
  return {
    status: 'ok',
    outputs: outputsByName,
    trace: result.trace,
  };
}

function describeFieldTypeForDescription(field: FieldDef): string {
  switch (field.type) {
    case 'enum':
      return `enum: ${(field.enumValues ?? []).join(', ') || '(no values)'}`;
    case 'date':
      return 'ISO 8601 date';
    case 'datetime':
      return 'ISO 8601 datetime';
    default:
      return field.type;
  }
}

/**
 * Build the natural-language tool description an MCP client sees.
 *
 * LLMs pick which tool to call from this string. Just echoing
 * `logic.description` (or a generic fallback) leaves them guessing at the
 * input/output shape — so we append a structured summary of every field and
 * every possible output column. The author's prose stays at the top; the
 * machine-readable summary lives below a blank line.
 */
export function logicToToolDescription(logic: Logic): string {
  const base =
    logic.description?.trim() ||
    `Evaluate the "${logic.name}" decision logic. Returns the matched conclusion or "no_match".`;

  const inputs = Object.values(logic.fieldDefs);
  const outputNames = collectAllOutputColumnNames(logic);

  const sections: string[] = [base];

  if (inputs.length > 0) {
    const lines = ['', 'Inputs (all optional; missing inputs match any cell):'];
    for (const field of inputs) {
      lines.push(`- ${field.name} (${describeFieldTypeForDescription(field)})`);
    }
    sections.push(lines.join('\n'));
  }

  if (outputNames.length > 0) {
    const lines = ['', 'Outputs (present when status="ok"):'];
    for (const name of outputNames) {
      lines.push(`- ${name}`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n');
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
}

/**
 * Build an MCP-compatible tool definition from a Logic.
 *
 * The returned object can be plugged directly into an MCP server's tool
 * list (`name`, `description`, `inputSchema`) and the `outputSchema` is
 * available for clients that consult it (some LLM frameworks do, the MCP
 * spec itself treats it as informational).
 */
export function logicToMcpTool(logic: Logic): McpToolDefinition {
  return {
    name: logicNameToToolSlug(logic.name),
    description: logicToToolDescription(logic),
    inputSchema: logicToInputSchema(logic),
    outputSchema: logicToOutputSchema(logic),
  };
}

// ---------------------------------------------------------------------------
// LLM-facing trace formatting
// ---------------------------------------------------------------------------
//
// The engine's `TraceStep` is shaped for editor consumption: it keys rows and
// columns by their internal `r1` / `oc2` style IDs. Those IDs are meaningless
// to an LLM (and to a human reading a tool-call log), so the MCP server
// reshapes the trace before returning it. Tables become names, rows become
// 1-based indices, and the column that caused a row to skip becomes the
// human-readable field name.

export interface FormattedTraceMatchedRow {
  /** 1-based row index within the table, matching how rows are displayed in the editor UI. */
  index: number;
  /** Whether the row terminated evaluation or chained into another table. */
  conclusion: 'terminal' | 'continue';
  /** Name of the next table when `conclusion === "continue"`. */
  nextTable?: string;
}

export interface FormattedTraceSkippedRow {
  /** 1-based row index within the table. */
  index: number;
  /** Field name whose cell did not match the input. */
  failedField: string;
}

export interface FormattedTraceStep {
  /** Table name as written in the logic. */
  table: string;
  /** 0-based depth in the chain of continues. */
  depth: number;
  /** The row that matched, or `null` if every row was skipped. */
  matchedRow: FormattedTraceMatchedRow | null;
  /** Rows skipped before the match (or all rows when nothing matched). */
  skippedRows: FormattedTraceSkippedRow[];
}

/**
 * Reshape an engine trace for LLM / MCP consumption: drop every internal ID,
 * replace them with names and 1-based indices that align with the editor UI.
 */
export function formatTrace(
  logic: Logic,
  trace: TraceStep[],
): FormattedTraceStep[] {
  type Lookup = {
    rowIdToIndex: Map<string, number>;
    rowIdToRow: Map<string, Logic['tables'][string]['rows'][number]>;
    colIdToFieldName: Map<string, string>;
  };
  const tableLookups = new Map<string, Lookup>();
  for (const table of Object.values(logic.tables)) {
    const rowIdToIndex = new Map<string, number>();
    const rowIdToRow = new Map<string, (typeof table.rows)[number]>();
    table.rows.forEach((row, i) => {
      rowIdToIndex.set(row.id, i + 1);
      rowIdToRow.set(row.id, row);
    });
    const colIdToFieldName = new Map<string, string>();
    for (const col of table.cols) {
      if (!col.fieldId) continue;
      const field = logic.fieldDefs[col.fieldId];
      if (field) colIdToFieldName.set(col.id, field.name);
    }
    tableLookups.set(table.id, { rowIdToIndex, rowIdToRow, colIdToFieldName });
  }

  return trace.map((step) => {
    const lookup = tableLookups.get(step.tableId);

    let matchedRow: FormattedTraceMatchedRow | null = null;
    if (step.matchedRowId) {
      const index = lookup?.rowIdToIndex.get(step.matchedRowId);
      const row = lookup?.rowIdToRow.get(step.matchedRowId);
      if (index !== undefined && row) {
        if (row.conclusion.type === 'continue') {
          matchedRow = {
            index,
            conclusion: 'continue',
            nextTable: logic.tables[row.conclusion.tableId]?.name,
          };
        } else {
          matchedRow = { index, conclusion: 'terminal' };
        }
      }
    }

    const skippedRows: FormattedTraceSkippedRow[] = step.skippedRows.map(
      (sr) => ({
        index: lookup?.rowIdToIndex.get(sr.rowId) ?? 0,
        failedField:
          lookup?.colIdToFieldName.get(sr.failedColId) ?? sr.failedColId,
      }),
    );

    return {
      table: step.tableName,
      depth: step.depth,
      matchedRow,
      skippedRows,
    };
  });
}

// ---------------------------------------------------------------------------
// Zod-shaped helpers for the MCP TypeScript SDK
// ---------------------------------------------------------------------------
//
// The wire-level shape of an MCP tool is JSON Schema (covered by
// `logicToInputSchema` / `logicToOutputSchema` / `logicToMcpTool` above).
// However the high-level `McpServer.registerTool` API of
// `@modelcontextprotocol/sdk` accepts only Zod schemas (specifically a
// `ZodRawShape` — a `Record<string, ZodTypeAny>`) and converts them to JSON
// Schema internally. The helpers below produce that Zod shape directly so
// that callers wiring LEVERIE into `McpServer` don't have to build it twice.
//
// Both helpers intentionally return ZodRawShape (top-level property bag), not
// pre-wrapped `z.object(...)`, because that is the contract
// `McpServer.registerTool({ inputSchema, outputSchema })` expects.

export type ZodRawShape = Record<string, z.ZodTypeAny>;

function fieldToZod(field: FieldDef): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (field.type) {
    case 'number':
      base = z.number();
      break;
    case 'bool':
      base = z.boolean();
      break;
    case 'enum':
      base =
        field.enumValues && field.enumValues.length > 0
          ? z.enum(field.enumValues as [string, ...string[]])
          : z.string();
      break;
    case 'date':
      base = z
        .string()
        .describe(`Field: ${field.name} (ISO 8601 date, e.g. "2026-05-17")`);
      return base.optional();
    case 'datetime':
      base = z.string().describe(`Field: ${field.name} (ISO 8601 datetime)`);
      return base.optional();
    default:
      base = z.string();
  }
  return base.describe(`Field: ${field.name}`).optional();
}

/**
 * Build a `ZodRawShape` describing the inputs accepted by this Logic, suitable
 * for passing as `inputSchema` to `McpServer.registerTool` from
 * `@modelcontextprotocol/sdk`.
 *
 * Properties are keyed by **field name** (matching `logicToInputSchema`), and
 * all fields are optional — LEVERIE treats missing inputs as wildcard matches.
 */
export function logicToZodInputShape(logic: Logic): ZodRawShape {
  const shape: ZodRawShape = {};
  for (const field of Object.values(logic.fieldDefs)) {
    shape[field.name] = fieldToZod(field);
  }
  return shape;
}

/**
 * Build a `ZodRawShape` describing the evaluation result returned by this
 * Logic, suitable for passing as `outputSchema` to `McpServer.registerTool`.
 *
 * The shape is a single object with four fields:
 *   - `status`: `"ok" | "no_match"`
 *   - `outputs`: nested object keyed by output column name (present when ok)
 *   - `unmatchedTable`: name of the table where evaluation stopped (present when no_match)
 *   - `trace`: name-keyed evaluation trace (see `formatTrace`)
 *
 * Note this is intentionally less strict than `logicToOutputSchema`'s `oneOf`
 * union: the SDK's `McpServer` normalizes schemas to a single object shape and
 * drops unions during JSON-Schema emission. Callers that need the precise
 * discriminated-union JSON Schema should keep using `logicToOutputSchema`
 * (e.g. when documenting tools for non-SDK consumers).
 */
export function logicToZodOutputShape(logic: Logic): ZodRawShape {
  const outputNames = collectAllOutputColumnNames(logic);
  const outputShape: ZodRawShape = {};
  for (const name of outputNames) {
    outputShape[name] = z
      .string()
      .optional()
      .describe(`Output column: ${name}`);
  }

  const traceStepShape = z.object({
    table: z.string().describe('Table name.'),
    depth: z.number().describe('0-based depth in the continue chain.'),
    matchedRow: z
      .object({
        index: z.number().describe('1-based row index within the table.'),
        conclusion: z
          .enum(['terminal', 'continue'])
          .describe(
            '"terminal" stops evaluation; "continue" chains into nextTable.',
          ),
        nextTable: z
          .string()
          .optional()
          .describe('Name of the next table when conclusion="continue".'),
      })
      .nullable()
      .describe(
        'Row that matched, or null if every row was skipped at this depth.',
      ),
    skippedRows: z
      .array(
        z.object({
          index: z.number().describe('1-based row index that was skipped.'),
          failedField: z
            .string()
            .describe('Field name whose cell did not match.'),
        }),
      )
      .describe('Rows skipped before the match (or all rows on no_match).'),
  });

  return {
    status: z
      .enum(['ok', 'no_match'])
      .describe(
        '"ok" when a terminal conclusion was reached; "no_match" when evaluation ended without a matching row.',
      ),
    outputs: z
      .object(outputShape)
      .optional()
      .describe(
        'Outputs from the matched terminal conclusion. Present when status="ok".',
      ),
    unmatchedTable: z
      .string()
      .optional()
      .describe(
        'Name of the table where no row matched. Present when status="no_match".',
      ),
    trace: z
      .array(traceStepShape)
      .optional()
      .describe(
        'Evaluation trace: every table visited, which row matched (1-based), and which rows were skipped and why.',
      ),
  };
}
