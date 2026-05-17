# @leverie/checks

> Quality checks for [LEVERIE](https://github.com/remi0753/leverie) decision tables — duplicates, unreachable rows, contradictions, and coverage gaps.

Pure functions you can run inside an editor, a CI pipeline, or a CLI to validate a Logic before publishing.

## Install

```bash
pnpm add @leverie/checks @leverie/engine
```

`@leverie/engine` provides the Logic types that `@leverie/checks` consumes.

## Usage

```ts
import {
  findDuplicateRows,
  findUnreachableRows,
  findContradictoryRows,
  findCoverageGaps,
  checkCoverage,
} from '@leverie/checks';

const duplicates    = findDuplicateRows(table);
const unreachable   = findUnreachableRows(table);
const contradictions = findContradictoryRows(table, logic.fieldDefs);
const gaps          = findCoverageGaps(table, logic.fieldDefs);
const coverage      = checkCoverage(table, logic.fieldDefs);
```

## Exports

| Function | What it returns |
|---|---|
| `findDuplicateRows(table)` | `Set<rowId>` — rows with identical conditions to an earlier row. |
| `findUnreachableRows(table)` | `Set<rowId>` — rows strictly covered by an earlier row (first-match semantics will never reach them). |
| `findContradictoryRows(table, fieldDefs)` | `Map<rowId, ContradictoryInfo>` — rows where one field is constrained contradictorily across columns (L1–L6 rules). |
| `findCoverageGaps(table, fieldDefs)` | `CoverageGap[]` — combinations of `enum` / `bool` values that no row matches. |
| `hasDefaultRow(table, fieldDefs)` | `true` if `findCoverageGaps` is empty. |
| `checkCoverage(table, fieldDefs)` | Cartesian coverage analysis: total combinations + the list of uncovered ones (truncated at 64). |
| `canReference(fromTableId, toTableId, tables)` | `true` if adding a `Continue` reference from → to would not create a cycle. |

## License

Apache-2.0. See [LICENSE](./LICENSE).
