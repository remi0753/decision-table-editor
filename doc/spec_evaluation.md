# 5. Evaluation Model (Execution Algorithm)

## 5.1 Starting evaluation

1. The user provides an input context `inputs` (a map keyed by field ID, valued by the input value).
2. Evaluation starts at the table identified by `entryTableId`.

## 5.2 Evaluating a table

Evaluation runs by recursively calling `evaluateTable(tableId, inputs, previousTrace, depth)`. The detailed implementation (including trace collection) is in §5.3. Conceptual overview:

```
MAX_DEPTH = 50  // Max nesting depth of continue references. Safety valve against infinite loops from corrupted data.

evaluateTable(tableId, inputs, previousTrace = [], depth = 0):
  // Depth guard: fail-safe in case imported corrupted data still contains a cycle
  if depth > MAX_DEPTH:
    return { status: "no_match", tableId: tableId, trace: previousTrace }
  table = tables[tableId]
  for each row in table.rows (top to bottom):
    if rowMatches(row, table.cols, inputs):
      if row.conclusion.type == "terminal":
        return { status: "ok", outputs: row.conclusion.outputs, trace: [...previousTrace, stepTrace] }
      if row.conclusion.type == "continue":
        return evaluateTable(row.conclusion.tableId, inputs, [...previousTrace, stepTrace], depth + 1)
  return { status: "no_match", tableId: tableId, trace: [...previousTrace, stepTrace] }
```

> **Function signature**: `evaluateTable(tableId, inputs, previousTrace, depth)` — four arguments.
>
> - `previousTrace` is passed as an empty array `[]` at the start of evaluation
> - `depth` is passed as `0` at the start (the entry table). Each continue reference recurses with `depth + 1`
> - Call from §5.1: `evaluateTable(entryTableId, inputs, [], 0)`
> - Cycles are prevented on data save in §6.1, but as a safety valve for corrupted imports, evaluation is forcibly terminated when `depth > MAX_DEPTH`. `MAX_DEPTH = 50` is set as an upper bound on the continue-reference depth that a realistic logic would need

## 5.3 Row matching

```
rowMatches(row, cols, inputs):
  // Returns: { matched: bool, failedColId: string | null }
  // failedColId is for trace collection. The cols array is evaluated left to right (definition order),
  // and among columns whose condition cell exists (not a wildcard) and whose fieldId is not null,
  // it returns the ID of the first column that did not match. If all are wildcards, null.
  // Note: failedColId is null only when matched: true.
  //   When matched: false, the ID (string) of the failing column is always returned.
  //   Therefore the failedColId of an entry added to skippedRows is always non-null.
  for each col in cols:
    cell = row.cells[col.id]
    if cell is undefined: continue  // wildcard
    if col.fieldId is null: continue  // skip columns with no field selected (see note below)
    input = inputs[col.fieldId]
    if NOT cellMatches(cell, input, fieldDefs[col.fieldId]):
      return { matched: false, failedColId: col.id }
  return { matched: true, failedColId: null }
```

> **Handling `fieldId == null` columns (design intent)**: a condition column with `fieldId` unset is treated as **equivalent to a wildcard** at evaluation time and is skipped regardless of its condition cell content. This reflects the design intent that "a column with no field selected does not act as a condition," and is the specified behavior.
>
> **A row where all columns are `fieldId == null`**: if all of a row's condition columns are unselected, that row returns `matched: true` for any input (equivalent to a default row). This is also intended behavior, but a user might create this state without realizing it. In the UI, when a cell belongs to a `fieldId == null` column yet has a condition set, show a warning on that cell ("disabled because no field is selected") to prompt the user to select a field.

`evaluateTable` uses the result of `rowMatches` as follows:

```
evaluateTable(tableId, inputs, previousTrace, depth):
  table     = tables[tableId]
  stepTrace = { tableId, tableName: table.name, depth, matchedRowId: null, skippedRows: [] }

  for each row in table.rows:
    result = rowMatches(row, table.cols, inputs)
    if result.matched:
      // A matched row is recorded in matchedRowId. It is not added to skippedRows.
      // Including continue rows, the "matched row" is always set in matchedRowId.
      stepTrace.matchedRowId = row.id
      if row.conclusion.type == "terminal":
        return { status: "ok", outputs: row.conclusion.outputs,
                 trace: [...previousTrace, stepTrace] }
      if row.conclusion.type == "continue":
        // append this table's stepTrace to previousTrace and go to the next table
        return evaluateTable(row.conclusion.tableId, inputs,
                             [...previousTrace, stepTrace], depth + 1)
    else:
      // only non-matching rows are recorded in skippedRows
      stepTrace.skippedRows.push({ rowId: row.id, failedColId: result.failedColId })

  // no row matched in this table
  return { status: "no_match", tableId,
           trace: [...previousTrace, stepTrace] }
```

## 5.4 Cell matching

```
cellMatches(cell, input, field):
  op  = cell.op
  val = cell.val   // scalar, or string[] for between / in
  a   = coerce(input, field.type)

  // The null operator checks whether the coerced value is null (valid for all types)
  if op == "null":
    return a == null

  // For operators other than null, if the input is null (missing or coercion failed) it is always false
  if a == null:
    return false

  // between / in have an array val, so coerce is applied per element
  if op == "between":
    lo = coerce(val[0], field.type)
    hi = coerce(val[1], field.type)
    if lo == null or hi == null: return false   // invalid range values
    if cmp(lo) > cmp(hi): return false          // lo > hi is prevented in the UI, but the engine defensively returns false too
    return cmp(lo) <= cmp(a) <= cmp(hi)   // see cmp() below

  if op == "in":
    bs = val.map(v => coerce(v, field.type)).filter(b => b != null)  // drop coercion failures (corrupted data)
    if bs is empty: return false   // zero valid comparison values (all stored data invalid)
    return bs.some(b => cmp(a) == cmp(b))

  // valueless date-comparison operators (no val needed, handled first; no coerce of b needed)
  if op == "before_today":    return cmp(a) <  cmp(today())
  if op == "today_or_before": return cmp(a) <= cmp(today())
  if op == "after_today":     return cmp(a) >  cmp(today())
  if op == "today_or_after":  return cmp(a) >= cmp(today())

  // scalar operators (val required; return false on coercion failure)
  b = coerce(val, field.type)
  if b == null: return false   // invalid stored value (e.g. corrupted data)

  switch op:
    "="              → cmp(a) == cmp(b)
    "!="             → cmp(a) != cmp(b)
    "<"              → cmp(a) <  cmp(b)
    "<="             → cmp(a) <= cmp(b)
    ">"              → cmp(a) >  cmp(b)
    ">="             → cmp(a) >= cmp(b)
    "contains"       → String(a).includes(String(b))
    "starts_with"    → String(a).startsWith(String(b))
    "ends_with"      → String(a).endsWith(String(b))
    default          → false   // unknown operator (corrupted import data, or a file from a future extended version)
```

> **`default` behavior of `switch op`**: if `op` contains an operator string not defined by this spec, return `false` (do not crash). This means that even when loading corrupted imported data or a file containing operators added by a future version, that condition cell is safely treated as "no match."
>
> **Scope of the `null` operator**: usable for all types (`string` / `number` / `bool` / `enum` / `date` / `datetime`). As shown in the pseudocode above, the `null` operator is evaluated before the others and returns `true` if the coerced value is `null`.
> For operators other than `null`, if `coerce` returns `null` (missing input or coercion failure), the early return yields **`false`**.

### `cmp(v)` — conversion to a comparable value

```
cmp(v):
  v is a Date object → v.getTime()   // date / datetime types
  otherwise          → v             // number / string / bool / enum as-is
```

For `date` / `datetime` types, `coerce` returns a `Date` object, so `cmp()` converts it to `.getTime()` (epoch milliseconds) before comparison. This makes values that include a timezone compare correctly.

### `today()` — getting the current date

```
today():
  d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // Returns a Date object at 00:00:00.000 of today (local time)
  // cmp(today()) is the start-of-day epoch milliseconds
```

A `date` input `"2024-04-01"` becomes `new Date("2024-04-01T00:00:00")` (local 00:00:00) via `parseDate`. Boundary condition for `today_or_before`: an input of today yields `cmp(a) == cmp(today())` and is judged true by `<=` (today is included).

## 5.5 Type coercion (coerce)

Conversion **prioritizes the field's type** above all. Preferring the type definition over the form of the input value (whether it looks numeric) prevents a `string`-type field value `"123"` from being mis-evaluated as the number `123`.

```
coerce(s, fieldType):
  // Stage 1: check for empty string / null before any other conversion
  s == null or s === ""      → null
  // Stage 2: convert according to the field type
  fieldType == "number"      → Number(s) (null if NaN)
  fieldType == "bool"        → s === "true" ? true : s === "false" ? false : null
  fieldType == "date"        → parseDate(s) (null if the date string is invalid)
  fieldType == "datetime"    → parseDateTime(s) (null if invalid)
  fieldType == "enum"        → s (kept as string)
  fieldType == "string"      → s (kept as string)
  otherwise ("any", etc.)    → s (kept as string)

parseDate(s):
  new Date(s + "T00:00:00") (treated as local timezone)
  Invalid Date → null

parseDateTime(s):
  // Required: YYYY-MM-DDTHH:mm:ss, optional: .SSS and timezone
  // Regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/
  // The milliseconds part accepts 1-3 digits (.S / .SS / .SSS); 4+ digits is invalid.
  if s does not match the pattern → null
  new Date(s)  // delegated to the browser Date constructor
  Invalid Date → null
  // Without a timezone, it is interpreted as local time
  // With a timezone (Z / +HH:mm / -HH:mm), it is converted to and held as UTC
  // Comparison is done uniformly via .getTime() (epoch milliseconds)
```

## 5.6 Termination conditions and return value

Evaluation terminates in one of the following ways, always returning trace information.

| Termination condition                     | Return value                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Matched a row with a Terminal conclusion  | `{ status: "ok", outputs: { [outputColId]: string }, trace: TraceStep[] }` |
| No row matched                            | `{ status: "no_match", tableId: string, trace: TraceStep[] }`              |

Structure of `TraceStep`:

```ts
{
  tableId: string,       // ID of the evaluated table
  tableName: string,     // display name of the table
  depth: number,         // evaluation depth (0 = entry table, >= 1 = continue target)
  matchedRowId: string | null,  // ID of the matched row (null = NO_MATCH)
  skippedRows: {         // rows that did not match, and why
    rowId: string,
    failedColId: string  // ID of the first column that did not match (cols definition order)
                         // Note: only matched:false rows enter skippedRows,
                         //   so failedColId is always a non-null string here
  }[]
}
```

The `depth` field is used by the UI to tell whether a step is the entry table (`depth == 0`) or a continue target (`depth >= 1`). It is the flag used to vary the NO_MATCH message.

Including trace information even on `NO_MATCH` makes it clear at which row of which table evaluation got stuck.

Because cycles are prevented on data save (see [spec_quality_checks.md §6.1](spec_quality_checks.md)), no infinite loop can occur during evaluation.
