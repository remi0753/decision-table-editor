# @leverie/schema

> Generates JSON Schema (and MCP tool definitions) from a [LEVERIE](https://github.com/remi0753/leverie) Logic.

Auto-derive LLM-ready input/output schemas from the field-type definitions stored in a LEVERIE Logic — no hand-written JSON Schema, no drift between editor and integration.

## Install

```bash
pnpm add @leverie/schema @leverie/engine
```

## Usage

```ts
import {
  evaluateLogicByName,
  logicToInputSchema,
  logicToOutputSchema,
  logicToMcpTool,
} from '@leverie/schema';

const inputSchema  = logicToInputSchema(logic);
const outputSchema = logicToOutputSchema(logic);

// One-shot MCP tool definition.
const tool = logicToMcpTool(logic);
// → { name: 'loan_review',
//     description: '...',
//     inputSchema:  { ... },
//     outputSchema: { ... } }

// Evaluate using the same name-keyed shape advertised by the schemas above —
// no need to know the internal `fieldId` / `outputColId` values.
const result = evaluateLogicByName(logic, {
  'Customer Type': 'Corp',
  Amount: '1500000',
});
// → { status: 'ok',
//     outputs: { Decision: 'Approve', Reason: 'Large corporate loan' },
//     trace: [...] }
```

Generated schemas use **draft 2020-12**, key properties by **field name** (not internal IDs), and model the evaluation result as a discriminated union over `status: 'ok' | 'no_match'`. `evaluateLogicByName` closes the round-trip: the inputs it accepts and the outputs it returns match `logicToInputSchema` and `logicToOutputSchema` exactly, so an LLM tool call validated against the schemas can flow straight into evaluation without any id ↔ name plumbing.

## Exports

| Function | Returns |
|---|---|
| `logicToInputSchema(logic)` | `JsonSchema` describing the inputs the Logic accepts. |
| `logicToOutputSchema(logic)` | `JsonSchema` describing the result (`status` + `outputs` for `ok`, `status` + `tableId` for `no_match`). |
| `logicToMcpTool(logic)` | `McpToolDefinition` — slugged name + description + input/output schemas. Plug directly into an MCP server's tool list. |
| `logicNameToToolSlug(name)` | Convert a Logic's display name into a lower-snake-case tool slug. |
| `evaluateLogicByName(logic, inputsByName)` | Evaluate `logic` with name-keyed inputs and receive name-keyed outputs — the MCP-/LLM-facing counterpart to `evaluateTable` from `@leverie/engine`. |
| `JsonSchema`, `McpToolDefinition`, `EvalResultByName` | Exported TypeScript types. |

## License

Apache-2.0. See [LICENSE](./LICENSE).
