# 6. Quality Checks & Validation

## 6.0 When validations run

| Check                                            | When it runs                                        | Notes                                                                    |
| ------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Duplicate-rule detection (§6.2)                  | **Real time** (300ms after editing stops)           | Runs automatically on every condition-cell edit / row reorder           |
| Unreachable-row detection (§6.3)                 | **Real time** (300ms after editing stops)           | Runs automatically on every condition-cell edit / row reorder           |
| No-default-row warning (§6.4)                    | **Real time** (300ms after editing stops)           | Decided automatically on every row add/remove / condition change        |
| Coverage check (§6.8)                            | **On button press only**                            | Run manually because of the risk of combinatorial explosion             |
| Cycle prevention (§6.1)                          | **Real time, on action**                            | Decided immediately in the continue-target picker; cyclic options shown disabled |
| Table-deletion validation (§6.5)                 | **On action**                                       | Decided the moment the delete button is pressed                         |
| Field type-change confirmation (§3.2)            | **On action**                                       | Show a confirmation dialog the moment a type change is committed (may be skipped if zero affected cells) |
| Field-deletion validation (§3.2)                 | **On action**                                       | Reference check the moment the delete button is pressed; if referenced, reject and list them |
| `enumValues` value-deletion validation (§3.2)    | **On action**                                       | Search for cells using the value the moment its delete button is pressed; if in use, reject |
| Output-column required constraint (§6.7)         | **Always**                                          | When only one remains, the delete button is always shown `disabled`     |

Duplicate, unreachable, and no-default-row warnings are meant to be checked while looking at the table, so it is valuable to always show the latest state. Only the coverage check is run manually.

## 6.1 Cycle prevention (hard block)

When a continue reference (`conclusion.type == "continue"`) is about to be set on a cell, **detect cycles in real time and reject any setting that would create a cycle at the action level**.

Detection algorithm (cycle detection via DFS):

```
canReference(fromTableId, toTableId):
  // Check whether fromTableId is reachable from toTableId
  visited = {}
  stack = [toTableId]
  while stack is not empty:
    current = stack.pop()
    if current == fromTableId: return false  // would create a cycle
    if visited[current]: continue
    if tables[current] is undefined: continue  // ignore references to deleted tables (defensive)
    visited[current] = true
    for each row in tables[current].rows:
      if row.conclusion.type == "continue":
        stack.push(row.conclusion.tableId)
  return true  // no cycle
```

In the UI where the user picks a target table, options that would create a cycle are shown as **unselectable (disabled)**. Rather than raising an error alert, the design simply does not let them be chosen.

## 6.2 Duplicate-rule detection

Within the same table, warn when **two or more rows have entirely identical condition cells** as a duplicate rule.

- Highlight the duplicate rows with a yellow warning badge.
- Saving and evaluation are still possible (it functions, since the upper row always wins, but the intent is unclear), yet the warning is shown continuously.

## 6.3 Unreachable-row detection (redundant-rule warning)

Warn when a row A above row B fully subsumes row B's conditions (any input that matches A always matches A, so B can never be reached).

- Shown with a red warning badge.
- Unreachable rows do not affect evaluation, but are likely a logic bug.

### Scope of the subsumption check (heuristic approximation)

Because full interval arithmetic is costly to implement, the subsumption check is an approximation limited to the following cases.

| Case                                                                  | Method                                       |
| --------------------------------------------------------------------- | -------------------------------------------- |
| Both rows have only `=` or wildcards                                   | Decide subsumption by exact match (reliable) |
| Row A is a wildcard (`row.cells[colId]` undefined) and B has a condition | A subsumes B (reliable)                    |
| Contains `!=`                                                         | **Skip** the subsumption check (to avoid false positives) |
| Contains `<`, `<=`, `>`, `>=` numeric comparisons                     | **Skip** the subsumption check (limit of the approximation) |
| Contains `in`, `between`                                              | **Skip** the subsumption check              |

Cases outside the above scope produce no warning (prioritizing the avoidance of false positives). A future complete implementation is deferred to [roadmap.md](roadmap.md).

> **On the different assumptions of §6.3 and §6.8**: §6.3 (unreachable rows) skips conditions containing `!=` because of its conservative implementation (false-positive avoidance first), whereas §6.8 (coverage computation) can compute coverage for conditions containing `!=`. This is an intentional design difference, not a contradiction. For tables composed solely of `enum` / `bool` types, running the §6.8 coverage check complements §6.3 by detecting unreachable patterns it cannot catch.

## 6.4 No-default-row warning

When a table has no row whose **condition cells are all wildcards** (i.e. a fallback row that matches any input), warn that coverage may not be guaranteed.

- Show a warning banner in the table header or at the bottom of the table.
- However, suppress the warning when:
  - The table is composed solely of `enum` / `bool` fields and the coverage check (§6.8) judged it "all patterns covered" (the §6.8 check is user-initiated, so do not suppress if it has not been run)
  - The table is a continue target and the inputs reachable from the parent table's conditions are clearly limited → **this automatic judgment is future work**. In the current version do not suppress; always show the warning but add the note "a fallback row may be unnecessary"

## 6.5 Table-deletion validation

Table deletion follows these constraints.

| Situation                                          | Behavior                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| The target is the entry table                      | **Reject deletion.** Prompt the user to first set a new entry table            |
| The target is continue-referenced by other tables  | **Reject deletion.** List the referencing tables and prompt to remove references first |
| There is only one table in the logic               | **Reject deletion.** A logic must have at least one table                       |
| Otherwise (including orphan tables)                 | Show a confirmation dialog and delete                                          |

**Handling orphan tables:**
Tables unreachable from the entry table (orphans) are visually distinguished on the DAG graph (e.g. grayed out) and shown with the warning "this table is not referenced from anywhere." Deleting orphan tables is recommended but not forced.

## 6.6 Unreachable-path detection (NO_MATCH at a continue target)

Statically detect the possibility that, after proceeding to table B via a continue reference, no row of table B matches.

- Warn when some row of table A is "continue → table B" and table B "has no default row."
- In the UI, phrase it as "for some input values this path may yield no result" (do not show technical terms to the user).

## 6.7 Output-column required constraint

It is a **hard constraint** that a table has at least one output column (`outputCols`).

| Operation                                                | Behavior                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Two or more output columns exist; deleting one           | If the target column has values set on its rows, confirm via modal before deleting; otherwise delete without confirmation |
| Only one output column; attempting to delete it          | Show the delete button as `disabled` with the tooltip "at least one output column is required," and reject deletion |

Modal wording (when values exist):

> "Deleting this output column will also delete the output values of X rows. This cannot be undone. Continue?"

**On tables with only `continue` conclusions:**

A table where every row has a continue (`continue`) conclusion is also required to have at least one `outputCols` (the constraint is not relaxed).

Reason: it causes less user confusion to have output columns in place from table creation than to ask for them at the moment a terminal row is added. It also keeps the implementation simpler by maintaining data-model consistency.

In the UI, for a table where all rows are continue references, show the following info at the top of the output-column management panel:

> "All rows of this table forward to another table, so the output-column values are currently unused. Once you add a terminal row, the output columns set here will be used."

## 6.8 Coverage visualization (enum / bool fields only)

For a table whose fields are of type `enum` or `bool`, visualize **whether a rule exists for every combination of defined values**.

- Target: only `enum` and `bool` fields (`string` / `number` are infinite, so not possible)
- Display: list the uncovered value combinations
- Because this check can be computationally expensive, run it only when the user explicitly presses a "run check" button

### Handling combinatorial explosion

When the total number of combinations (the product of the `enum` choice counts and 2 for each `bool`) **exceeds 64**, do not list them all; switch to a summary like "X undefined patterns exist." If the user needs the full list, provide it via CSV download.

Coverage computation rule per operator:

| Operator / state              | Choices treated as covered                                               |
| ----------------------------- | ------------------------------------------------------------------------ |
| Wildcard (no condition)       | All choices (all of `enumValues` / both `true` and `false` for `bool`)   |
| `=` (a specific value)        | Only that one                                                            |
| `!=` (other than a value)     | All choices except that value                                            |
| `in ["A", "B"]`               | The two: "A" and "B"                                                     |
| `null` (has no value)         | Not included in coverage computation (null is not a value in enumValues) |
