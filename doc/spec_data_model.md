# 3. Data Model

## 3.1 Root object of a whole Logic

```json
{
  "version": "2",
  "name": "Loan Review",
  "description": "Approval flow for individual and corporate loan applications",
  "entryTableId": "t1",
  "fieldDefs": {},
  "tables": {},
  "nField": 3,
  "nTable": 3,
  "nCol": 5,
  "nOCol": 3,
  "nRow": 10
}
```

| Key            | Type               | Description                                                                                     |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `version`      | `string`           | Data format version. Currently `"2"`                                                           |
| `name`         | `string`           | Display name of the logic                                                                      |
| `description`  | `string` (optional)| Purpose / description of the logic                                                             |
| `entryTableId` | `string`           | ID of the table where evaluation starts                                                        |
| `fieldDefs`    | `object`           | Map of field definitions keyed by field ID                                                     |
| `tables`       | `object`           | Map of tables keyed by table ID                                                                |
| `nField`       | `number`           | Counter for assigning the next field ID                                                        |
| `nTable`       | `number`           | Counter for assigning the next table ID                                                        |
| `nCol`         | `number`           | Counter for assigning the next condition-column ID (unique across the whole logic)             |
| `nOCol`        | `number`           | Counter for assigning the next output-column ID (unique across the whole logic). Its value equals "the max existing output-column ID + 1" |
| `nRow`         | `number`           | Counter for assigning the next rule-row ID (unique across the whole logic)                      |

**On ID scope**: field IDs, table IDs, column IDs, and row IDs are all **unique across the whole logic**. So that column `c1` of table t1 and column `c2` of table t2 do not collide, column IDs are assigned in logic scope rather than table scope. This makes a `row.cells[colId]` reference unambiguous.

## 3.2 Field definition (FieldDef)

```json
{
  "f1": {
    "id": "f1",
    "name": "Customer Type",
    "type": "enum",
    "enumValues": ["Corp", "Individual", "Government"]
  },
  "f2": {
    "id": "f2",
    "name": "Application Amount",
    "type": "number"
  }
}
```

| Key          | Type                       | Description                                                                                                                                                  |
| ------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `string`                   | `"f"` + sequence number (e.g. `"f1"`)                                                                                                                       |
| `name`       | `string`                   | Display name, **unique** within the logic (duplicates are rejected on save)                                                                                  |
| `type`       | `string`                   | Type identifier (see [spec_field_types.md](spec_field_types.md))                                                                                             |
| `enumValues` | `string[]` (enum type only)| Enumeration of possible values, used by the coverage check. **At least one required** (a field cannot be saved with zero values; error message: "Enter at least one choice") |

### Editing `enumValues`

Changes to an `enum` field's `enumValues` are handled by these rules.

| Operation     | Behavior                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a value   | No effect on existing condition cells. The added value becomes selectable in subsequent cell editing                                                                                            |
| Remove a value| If any cell uses the removed value as a condition, **reject the removal** and present the list of those condition cells to the user                                                              |
| Rename a value| Automatically update the `val` of every condition cell using the old name **across all tables in the whole logic** (since fields are shared logic-wide, this applies to all tables, not just the one currently displayed) |

### Changing a field's type

Changing a field definition's `type` is allowed, but these rules apply for data integrity.

- Before applying the type change, show a confirmation dialog:
  > "Changing the type of \"{field name}\" will reset the X conditions that use this field. Continue?" (X = number of affected condition cells)
- If the user confirms, clear the `op` and `val` of every condition cell that references the field as its `fieldId`, returning them to the wildcard state (remove that key from `row.cells`)
- The operator dropdown updates to match the new type
- If zero condition cells are affected, the confirmation dialog may be skipped

### Deleting a field definition

When a field definition is to be deleted, these rules apply.

| Situation                                                     | Behavior                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| A condition column (`col.fieldId`) references the field       | **Reject the deletion** and present the list of referencing columns to the user |
| Zero condition columns reference it                           | Delete without confirmation                                   |

Error message on rejection:

> "\"{field name}\" is used by condition columns in the following tables. Remove those references first: {Table A - Column 1}, {Table B - Column 2}"

To remove a reference, change the `fieldId` of each condition column to `null` (unselected), or delete the condition column entirely.

## 3.3 Table

```json
{
  "t1": {
    "id": "t1",
    "name": "Initial Review",
    "cols": [
      { "id": "c1", "fieldId": "f1" },
      { "id": "c2", "fieldId": "f2" }
    ],
    "outputCols": [
      { "id": "oc1", "name": "Action" },
      { "id": "oc2", "name": "Transfer Phone" }
    ],
    "rows": [
      {
        "id": "r1",
        "cells": {
          "c1": { "op": "=", "val": "Corp" },
          "c2": { "op": ">=", "val": "1000000" }
        },
        "conclusion": {
          "type": "terminal",
          "outputs": {
            "oc1": "Confirm the contract and guide them through approval",
            "oc2": "03-1234-5678"
          }
        }
      },
      {
        "id": "r2",
        "cells": {
          "c1": { "op": "=", "val": "Corp" }
        },
        "conclusion": { "type": "continue", "tableId": "t2" }
      },
      {
        "id": "r3",
        "cells": {},
        "conclusion": {
          "type": "terminal",
          "outputs": {
            "oc1": "Inform them it is out of scope and apologize"
          }
        }
      }
    ]
  }
}
```

**Fields of a Table:**

| Key          | Type          | Description                                                                                                                                                                                                                                         |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `string`      | `"t"` + sequence number (e.g. `"t1"`)                                                                                                                                                                                                              |
| `name`       | `string`      | Display name of the table, **unique** within the logic (a hard constraint), because Continue-reference pickers identify a table by name. On **manual input** (inline edit) duplicates are rejected; on **auto-generation** (the initial name from an add-table action) uniqueness is ensured automatically by appending a number |
| `cols`       | `Col[]`       | List of condition-column definitions (left-to-right order)                                                                                                                                                                                         |
| `outputCols` | `OutputCol[]` | List of output-column definitions. **At least one required** (a table with zero is auto-repaired on save/import)                                                                                                                                    |
| `rows`       | `Row[]`       | List of rule rows (top-to-bottom evaluation order)                                                                                                                                                                                                 |

**Fields of a condition column (Col):**

| Key       | Type             | Description                                              |
| --------- | ---------------- | ------------------------------------------------------- |
| `id`      | `string`         | `"c"` + sequence number (e.g. `"c1"`)                  |
| `fieldId` | `string \| null` | ID of the referenced field. `null` means unselected     |

**Fields of a rule row (Row):**

| Key          | Type                | Description                                                              |
| ------------ | ------------------- | ----------------------------------------------------------------------- |
| `id`         | `string`            | `"r"` + sequence number (unique across the whole logic)                 |
| `cells`      | `{ [colId]: Cell }` | Map of condition cells keyed by column ID. A missing key is a wildcard  |
| `conclusion` | `Conclusion`        | The conclusion when this row matches (see below)                        |

**Fields of a condition cell (Cell):**

| Key   | Type                 | Description                                          |
| ----- | -------------------- | --------------------------------------------------- |
| `op`  | `string`             | Operator (see [spec_field_types.md](spec_field_types.md)) |
| `val` | `string \| string[]` | Value(s) to compare against. Always stored as a string or array of strings |

**Fields of an output column (OutputCol):**

In addition to condition columns (`cols`), a table has **one or more output columns** (`outputCols`). Output columns are defined at the table level, and each terminal row supplies a value for them.

```json
"outputCols": [
  { "id": "oc1", "name": "Action" },
  { "id": "oc2", "name": "Transfer Phone" },
  { "id": "oc3", "name": "Note" }
]
```

| Key    | Type     | Description                                                                                                                                                                  |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`   | `string` | `"oc"` + sequence number (unique across the whole logic)                                                                                                                   |
| `name` | `string` | Display name of the output column. **Unique within the table** (duplicates are allowed across the logic; different tables may have output columns with the same name). When showing evaluation results, the `name` (not the `id`) is used as the label |

**Fields of a Conclusion:**

For a terminal conclusion:

```json
{
  "type": "terminal",
  "outputs": {
    "oc1": "Explain the cancellation fee (¥XX,XXX) and the switch to installment payments.",
    "oc2": "03-1234-5678",
    "oc3": "Fee waived during the campaign period"
  }
}
```

For a continue reference:

```json
{ "type": "continue", "tableId": "t2" }
```

| Key       | Type                                          | Description                                                                                                                  |
| --------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `type`    | `"terminal" \| "continue"`                    | Kind of conclusion                                                                                                         |
| `outputs` | `{ [outputColId]: string }` (terminal only)   | Map of output values keyed by output-column ID. Values are **always stored as strings**. Keys for undefined output-column IDs may be omitted (treated as empty string) |
| `tableId` | `string` (continue only)                      | ID of the table to evaluate next                                                                                          |

**The `nOCol` counter**: a counter for assigning output-column IDs is added to the root object (`nOCol`). Unique across the whole logic.
