# @leverie/engine

> Pure, headless decision-logic evaluation engine for [LEVERIE](https://github.com/remi0753/leverie).

Evaluate LEVERIE decision tables in any JavaScript runtime — Node, browser, edge — with zero UI or framework dependencies.

## Install

```bash
pnpm add @leverie/engine
# or
npm install @leverie/engine
```

## Usage

```ts
import { evaluateTable, LogicSchema, type Logic } from '@leverie/engine';

// Parse and validate a Logic JSON (exported from the LEVERIE editor).
const logic: Logic = LogicSchema.parse(JSON.parse(rawJson));

// Inputs may be keyed by either fieldId (`f1`, `f2`, …) or field name
// (`"Customer Type"`, `"Amount"`, …). Both shapes are accepted and the
// engine normalises them internally.
const result = evaluateTable(
  logic.entryTableId,
  { 'Customer Type': 'Corp', Amount: '1500000' },
  logic,
);

if (result.status === 'ok') {
  // Outputs are keyed by output-column id (`oc1`, `oc2`, …). Map them back
  // to display names via the matched table's `outputCols`, or use
  // `evaluateLogicByName` from `@leverie/schema` for an LLM-/MCP-friendly
  // round-trip that returns outputs already keyed by name.
  console.log(result.outputs); // e.g. { oc1: 'Approve', oc2: 'Large corporate loan' }
  console.log(result.trace);   // step-by-step trace
}
```

## Exports

| Symbol | Purpose |
|---|---|
| `evaluateTable(tableId, inputs, logic)` | Evaluate a Logic starting from a table. Follows `Continue` references until a terminal conclusion is reached. |
| `runBatchEvaluation(cases, logic)` | Evaluate many cases at once. |
| `coerce(value, fieldDef)` / `cmp` / `today` | Value coercion and comparison helpers used internally; exported for advanced callers. |
| `LogicSchema` (Zod) | Validate Logic JSON at runtime. |
| `FieldDefsFileSchema` (Zod) | Validate field-definitions JSON. |
| Logic types | `Logic`, `Table`, `Row`, `Col`, `FieldDef`, `Cell`, `Conclusion`, `EvalResult`, … exported as TypeScript types. |

## License

Apache-2.0. See [LICENSE](./LICENSE).
