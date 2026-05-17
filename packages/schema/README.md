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
```

Generated schemas use **draft 2020-12**, key properties by **field name** (not internal IDs), and model the evaluation result as a discriminated union over `status: 'ok' | 'no_match'`.

## Exports

| Function | Returns |
|---|---|
| `logicToInputSchema(logic)` | `JsonSchema` describing the inputs the Logic accepts. |
| `logicToOutputSchema(logic)` | `JsonSchema` describing the result (`status` + `outputs` for `ok`, `status` + `tableId` for `no_match`). |
| `logicToMcpTool(logic)` | `McpToolDefinition` — slugged name + description + input/output schemas. Plug directly into an MCP server's tool list. |
| `logicNameToToolSlug(name)` | Convert a Logic's display name into a lower-snake-case tool slug. |
| `JsonSchema`, `McpToolDefinition` | Exported TypeScript types. |

## License

Apache-2.0. See [LICENSE](./LICENSE).
