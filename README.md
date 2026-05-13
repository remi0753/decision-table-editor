# LEVERIE

**Pronunciation:** /lɛvəˈrie/ · レヴァリエ *(the Japanese reading is a respectful nod to ZUN of [Team Shanghai Alice](https://www16.big.or.jp/~zun/))*

The name is inspired by *reverie* — a state of pleasant, effortless thought. The leading **L** reflects the tool's core purpose: **Logic**. Together, LEVERIE evokes the idea of navigating complex decision logic as naturally as a train of thought.

A browser-based editor for building and evaluating **decision logic** as interconnected tables — no code required.

## Concept

Decision logic ("if X and Y then Z, else if …") is often expressed as flowcharts or nested if-statements. Both forms are hard to read, maintain, and verify for correctness. This tool lets you describe the same logic as **Excel-style tables** and automatically checks them for gaps and contradictions.

### How it works

A **Logic** is a directed acyclic graph (DAG) of **Tables**. Evaluation starts at the entry table and follows *Continue* references until a *Terminal* conclusion is reached.

Each table is evaluated row by row from top to bottom. The **first row whose every condition cell matches** the input is selected (first-match semantics). A condition cell that is left blank acts as a **wildcard** and matches any value.

```
Input values
     │
     ▼
┌─────────────────────────┐
│  Entry Table            │  ← evaluation starts here
│  row 1: cond A  → Terminal "Result A"
│  row 2: cond B  → Continue ──────────────────┐
│  row 3: (wildcard) → Terminal "Result C"     │
└─────────────────────────┘                    │
                                               ▼
                                  ┌─────────────────────────┐
                                  │  Next Table             │
                                  │  row 1: cond X → Terminal "Result X"
                                  └─────────────────────────┘
```

### Core concepts

| Concept | Description |
|---------|-------------|
| **Logic** | One complete decision flow. Saved and shared as a single JSON file. |
| **Table** | An individual decision table — a grid of condition columns and rule rows. |
| **Field** | A named, typed data item (number, string, bool, enum, date, datetime). Defined once at the logic level and shared across all tables. |
| **Condition cell** | The intersection of a row and a column. Holds an operator (`=`, `>=`, `in`, `between`, …) and a value. An empty cell is a wildcard. |
| **Terminal conclusion** | The final output of the logic. Sets one or more named output columns. |
| **Continue conclusion** | Hands off evaluation to another table, passing the original inputs unchanged. |

### Quality checks

The editor continuously checks each table and highlights problems:

| Badge | Meaning |
|-------|---------|
| 🟡 Yellow `!` | **Duplicate** — this row has identical conditions to an earlier row and will never be reached first. |
| 🔴 Red `!` | **Unreachable** — an earlier row's conditions fully cover this row's conditions. |
| ⚠️ Banner | **No default row** — no row with all-wildcard conditions exists; some inputs may produce no result. |

---

## Getting started

### Prerequisites

- Node.js 18+

### Install and run

```bash
git clone <repo-url>
cd decision-table-editor
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### Build for production

```bash
npm run build
# Output is in dist/
```

---

## How to use

### 1. Define fields

The **フィールド定義** (Field Definition) panel is at the top of the right pane.

1. Type a field name in the text box.
2. Choose a type from the dropdown.
3. Click **＋ 追加** (or press Enter).

| Type | Description |
|------|-------------|
| `テキスト` (string) | Free-form text. Supports `=`, `!=`, `in`, `contains`, `starts_with`, `ends_with`. |
| `数値` (number) | Numeric. Supports `=`, `!=`, `<`, `<=`, `>`, `>=`, `between`. |
| `真偽値` (bool) | `true` / `false`. |
| `選択肢` (enum) | A predefined list of values. Add choices inline using the tag editor. |
| `日付` (date) | ISO 8601 date. Supports relative operators like `before_today`, `after_today`. |
| `日時` (datetime) | ISO 8601 date-time. |

**Changing a field's type** resets all condition cells that reference it (a confirmation dialog is shown).  
**Deleting a field** is blocked if any condition column still references it.

---

### 2. Build a table

#### Add a condition column

Click the **＋** button at the top-right of the table header. Then choose a field from the dropdown in the column header.

#### Add a row

Click **＋ 行を追加** below the table.

#### Edit a condition cell

Click any cell in the condition area to open a popup:

1. Choose an **operator** from the dropdown (the list is filtered by the column's field type).
2. Enter a **value** using the appropriate input (text, number, date picker, checkbox list, etc.).
3. Click **設定** to save, or **条件なし（ワイルドカード）** to make the cell match anything.

The cell displays a compact summary (`>= 100`, `法人, 個人`, `（条件なし）`, etc.).

#### Edit a conclusion

Click the **結論** cell to open a popup:

- **終端結論 (Terminal)** — fill in the output value for each output column.
- **継続参照 (Continue)** — pick the target table from the dropdown. Tables that would create a cycle are marked and disabled.

#### Reorder rows

Drag the grip handle (⠿) on the left of each row, or use the ▲ / ▼ arrow buttons.

#### Manage output columns

Click the ⚙ icon in the conclusion column header to add, rename, or delete output columns. A table must always have at least one output column.

---

### 3. Manage tables

The **left pane** shows the table list and a DAG graph of how tables reference each other.

| Action | How |
|--------|-----|
| Add a table | Click **＋ テーブルを追加** at the bottom of the list. |
| Switch to a table | Click its name in the list, or click its node in the DAG graph. |
| Rename a table | Click the table name in the editor header (inline edit). |
| Set as entry table | Click **入口に設定** next to the table name in the editor header. |
| Delete a table | Hover the table name in the list and click 🗑. Blocked if other tables reference it or if it is the entry table. |

The DAG graph shows:
- **Blue border** — the entry table (▶ badge).
- **Faded** — tables not reachable from the entry table.
- Directed edges — *Continue* references between tables.

---

### 4. Evaluate

The **評価パネル** (Evaluation Panel) is at the bottom of the right pane.

1. Enter values for each field in the input form.
2. Click **▶ 評価実行**.
3. The result is displayed along with a step-by-step **trace** showing which rows were checked, which were skipped, and why.

Click **↺ リセット** to clear all inputs and the result.

---

### 5. Save, export, and import

- **Auto-save** — the logic is saved to `localStorage` on every change. It is restored automatically on next load.
- **Export** — click **エクスポート** in the header to download a `.json` file.
- **Import** — click **インポート** to load a `.json` file. The file is validated with a schema check. Minor issues (broken references, missing output columns) are repaired automatically with a notification.

#### JSON format (v2)

```json
{
  "version": "2",
  "name": "ローン審査ロジック",
  "entryTableId": "t1",
  "fieldDefs": {
    "f1": { "id": "f1", "name": "顧客種別", "type": "enum", "enumValues": ["法人", "個人"] },
    "f2": { "id": "f2", "name": "申請金額", "type": "number" }
  },
  "tables": {
    "t1": {
      "id": "t1",
      "name": "初期審査",
      "cols": [{ "id": "c1", "fieldId": "f1" }, { "id": "c2", "fieldId": "f2" }],
      "outputCols": [{ "id": "oc1", "name": "結果" }],
      "rows": [
        {
          "id": "r1",
          "cells": { "c1": { "op": "=", "val": "法人" }, "c2": { "op": ">=", "val": "1000000" } },
          "conclusion": { "type": "terminal", "outputs": { "oc1": "承認" } }
        },
        {
          "id": "r2",
          "cells": {},
          "conclusion": { "type": "terminal", "outputs": { "oc1": "否認" } }
        }
      ]
    }
  },
  "nField": 3, "nTable": 2, "nCol": 3, "nOCol": 2, "nRow": 3
}
```

---

## Tech stack

| Category | Library |
|----------|---------|
| Framework | React 18 |
| Language | TypeScript 5 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| State management | Zustand 4 |
| Graph visualization | ReactFlow + dagre |
| Drag & drop | @dnd-kit |
| Schema validation | Zod |

---

## License

See [LICENSE](LICENSE).
