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

/**
 * Build a JSON Schema describing the result of evaluating this Logic.
 *
 * The result is a discriminated union over `status`:
 *
 * - `ok`: a terminal conclusion was reached. `outputs` contains one string
 *   per output column. The list of possible output columns is the union of
 *   `table.outputCols.name` across all tables.
 * - `no_match`: evaluation reached a table with no matching row.
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
        },
        required: ['status', 'outputs'],
      },
      {
        title: 'No match (evaluation ended without a matching row)',
        type: 'object',
        properties: {
          status: { const: 'no_match' },
          tableId: { type: 'string' },
        },
        required: ['status', 'tableId'],
      },
    ],
  };
}

/**
 * Convert an arbitrary string into an LLM-friendly tool name slug.
 * Lowercases, replaces non-alphanumerics with underscores, collapses
 * repeats, and trims leading/trailing underscores.
 */
export function logicNameToToolSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'logic'
  );
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
    description:
      logic.description ??
      `Evaluate the "${logic.name}" decision logic. Returns the matched conclusion or "no_match".`,
    inputSchema: logicToInputSchema(logic),
    outputSchema: logicToOutputSchema(logic),
  };
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
 * The shape is a single object with three fields:
 *   - `status`: `"ok" | "no_match"`
 *   - `outputs`: nested object keyed by output column name (present when ok)
 *   - `tableId`: identifier of the unmatched table (present when no_match)
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
    tableId: z
      .string()
      .optional()
      .describe(
        'Identifier of the table where no row matched. Present when status="no_match".',
      ),
  };
}
