# 4. Field Types and Condition Operators

## 4.1 Field type catalog

| Type value   | Display name | Description                                                          | Coverage check                          |
| ------------ | ------------ | ------------------------------------------------------------------- | --------------------------------------- |
| `"number"`   | Number       | Integers, decimals, negatives                                       | Requires a numeric range definition (future) |
| `"string"`   | Text         | Free-form text                                                      | Not possible (infinite value space)     |
| `"bool"`     | Boolean      | The two values `true` / `false`                                     | Possible (only two values)              |
| `"enum"`     | Enum         | Pick one of a predefined set of choices                             | **Possible** (uses enumValues)          |
| `"date"`     | Date         | A calendar date (no time), stored as `YYYY-MM-DD`                   | Not possible                            |
| `"datetime"` | Datetime     | Date + time. Seconds required; milliseconds and timezone optional (see below) | Not possible                  |

## 4.2 Operators supported per type

Operators are chosen from a dropdown in the UI; raw FEEL text input is not used. The set is limited to a subset that non-engineers can use intuitively.

### Operator-specific UI input constraints

| Operator  | Constraint                       | Behavior on violation                                                                                                                          |
| --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `in`      | At least **one** value required  | The cell cannot be saved with zero values. Show the error "Enter at least one value."                                                         |
| `between` | **End ≥ start** required         | If the end value is smaller than the start, put the end field into an error state and show "The end value must be greater than the start value." Do not auto-swap. |

### number type

| Operator  | Display              | Value input                  |
| --------- | -------------------- | ---------------------------- |
| `=`       | equals               | Number input                 |
| `!=`      | not equal            | Number input                 |
| `<`       | less than            | Number input                 |
| `<=`      | less than or equal   | Number input                 |
| `>`       | greater than         | Number input                 |
| `>=`      | greater than or equal| Number input                 |
| `between` | within range (incl.) | Two number inputs (from, to) |
| `null`    | has no value         | No value input               |

### string type

| Operator      | Display       | Value input                       |
| ------------- | ------------- | --------------------------------- |
| `=`           | equals        | Text input                        |
| `!=`          | not equal     | Text input                        |
| `in`          | matches any of| Multiple text inputs (tag style)  |
| `contains`    | contains      | Text input                        |
| `starts_with` | starts with   | Text input                        |
| `ends_with`   | ends with     | Text input                        |
| `null`        | has no value  | No value input                    |

### bool type

| Operator | Display      | Value input                  |
| -------- | ------------ | ---------------------------- |
| `=`      | equals       | `true` / `false` select      |
| `null`   | has no value | No value input               |

### enum type

| Operator | Display        | Value input                            |
| -------- | -------------- | -------------------------------------- |
| `=`      | equals         | Dropdown of enumValues                 |
| `!=`     | not equal      | Dropdown of enumValues                 |
| `in`     | matches any of | Multi-select checkboxes of enumValues  |
| `null`   | has no value   | No value input                         |

### date type

| Operator          | Display                              | Value input                              |
| ----------------- | ------------------------------------ | ---------------------------------------- |
| `=`               | equals                               | Date picker                              |
| `!=`              | not equal                            | Date picker                              |
| `<`               | before                               | Date picker                              |
| `<=`              | on or before                         | Date picker                              |
| `>`               | after                                | Date picker                              |
| `>=`              | on or after                          | Date picker                              |
| `between`         | within period (start–end)            | Two date pickers (from, to; inclusive)   |
| `before_today`    | before today (evaluated at run time) | No value input                           |
| `today_or_before` | today or before (evaluated at run time) | No value input                        |
| `after_today`     | after today (evaluated at run time)  | No value input                           |
| `today_or_after`  | today or after (evaluated at run time) | No value input                         |
| `null`            | has no value                         | No value input                           |

### datetime type

| Operator  | Display                          | Value input                                  |
| --------- | -------------------------------- | -------------------------------------------- |
| `=`       | equals                           | Datetime picker                              |
| `!=`      | not equal                        | Datetime picker                              |
| `<`       | before                           | Datetime picker                              |
| `<=`      | at or before                     | Datetime picker                              |
| `>`       | after                            | Datetime picker                              |
| `>=`      | at or after                      | Datetime picker                              |
| `between` | within period (start–end)        | Two datetime pickers (from, to; inclusive)   |
| `null`    | has no value                     | No value input                               |

> `before_today` / `today_or_before` / `after_today` / `today_or_after` compare against the **current date** at evaluation time. Rather than storing a fixed value in the input field, the evaluation engine reads `Date.now()`. Valid only for the `date` type (for `datetime`, minute-level comparison is needed, so defining separate `now_before` / `now_after` operators is left as future work).

## 4.3 Storage format of a cell's `val`

| Operator                                                                   | Type of `val`                | Example                                            |
| -------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| `=`, `!=`, `<`, `<=`, `>`, `>=`, `contains`, `starts_with`, `ends_with`    | `string`                     | `"Corp"`, `"1000000"`                              |
| `between`                                                                  | `string[]` (exactly 2)       | `["1000", "5000"]`, `["2024-04-01", "2024-06-30"]` |
| `in`                                                                       | `string[]`                   | `["Corp", "Individual"]`                           |
| `null`, `before_today`, `today_or_before`, `after_today`, `today_or_after` | not needed (omitted)         | —                                                  |

### Date and datetime storage format

| Type       | Storage format                                                              | Example        |
| ---------- | -------------------------------------------------------------------------- | -------------- |
| `date`     | ISO 8601 date string                                                        | `"2024-04-01"` |
| `datetime` | ISO 8601 datetime string (seconds required; `.SSS` and timezone optional)  | see below      |

**Valid formats for `datetime`:**

```
Required:  YYYY-MM-DDTHH:mm:ss
Optional:  [.SSS][Z | +HH:mm | -HH:mm]
```

| Example                           | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `"2024-04-01T10:30:00"`           | Down to seconds (no timezone = local time)   |
| `"2024-04-01T10:30:00.123"`       | With milliseconds                            |
| `"2024-04-01T10:30:00Z"`          | UTC                                          |
| `"2024-04-01T10:30:00+09:00"`     | JST                                          |
| `"2024-04-01T10:30:00.123+09:00"` | With milliseconds, JST                       |

When the timezone is omitted, the value is treated as local time. Values with a timezone are normalized to UTC before comparison so that mixed timezones still compare correctly. By default the UI datetime picker takes local-time input and stores it as a timezone-less string (treated as local).
