<p align="center">
  <img src="apps/editor/src/assets/logo.svg" alt="LEVERIE" height="56" />
  <h1 align="center">LEVERIE</h1>
  <p align="center">
    A browser-based editor for building and evaluating <strong>decision logic</strong> as interconnected tables — no code required.
  </p>
</p>

---

## Name

**Pronunciation:** /lɛvəˈrie/ · レヴァリエ

The name is inspired by *reverie* — a state of pleasant, effortless thought. The leading **L** reflects the tool's core purpose: **Logic**. Together, LEVERIE evokes the idea of navigating complex decision logic as naturally as a train of thought.

The Japanese reading is a respectful nod to ZUN of [Team Shanghai Alice](https://www16.big.or.jp/~zun/).

---

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
| ⚠️ Banner | **Coverage gap** — for tables made of `enum` / `bool` fields, some input combinations have no matching row. The flowchart view marks the gap as a phantom node. |

---

## Getting started

### Prerequisites

- Node.js 18+
- pnpm 9+ (this repo is a pnpm + Turborepo monorepo)

### Repository layout

```
apps/                # Deployable / distributable executables
  editor/            # browser SPA (this README focuses on running it)
  mcp-server/        # leverie-mcp — standalone MCP CLI (P1)
packages/            # Importable libraries
  engine/            # @leverie/engine — evaluation engine
  checks/            # @leverie/checks — quality checks
  schema/            # @leverie/schema — JSON Schema generation
```

**Role split:** `apps/*` are things you run or distribute — the SPA, the CLI/Docker image (`leverie-mcp`), and the future cloud API server. `packages/*` are pure libraries consumed via `import` (publishable to npm as `@leverie/*`).

### Install and run locally

```bash
git clone <repo-url>
cd decision-table-editor
pnpm install
pnpm dev
```

Open **http://localhost:5173** in your browser.

### Available scripts (root)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the editor's Vite dev server with HMR (via Turborepo). |
| `pnpm build` | Build the editor for production into `apps/editor/dist/`. |
| `pnpm build:packages` | Build all `packages/*` (engine / checks / schema) into their `dist/` directories. |
| `pnpm build:local` | Run Biome lint + TypeScript type-check + editor build. Use this before pushing. |
| `pnpm test` | Run Vitest across all packages. |
| `pnpm test:e2e` | Run local Playwright E2E against `apps/api`, `apps/editor`, and Docker Postgres. See [doc/e2e_testing.md](doc/e2e_testing.md). |
| `pnpm typecheck` | Run `tsc --noEmit` across all packages. |
| `pnpm lint` | Run Biome lint check. |
| `pnpm lint:fix` | Apply Biome auto-fixes. |
| `pnpm format` | Format the codebase with Biome. |

Editor-specific scripts (run with `pnpm --filter @leverie/editor <script>`):

| Script | Description |
|--------|-------------|
| `preview` | Build and serve via Wrangler (Cloudflare Workers preview). |
| `deploy` | Build and deploy to Cloudflare Workers. |

### Deployment

The app is a static SPA deployed to **Cloudflare Workers**. Configuration lives in [apps/editor/wrangler.jsonc](apps/editor/wrangler.jsonc) (`assets.not_found_handling: "single-page-application"` rewrites unknown paths to `index.html`).

---

## How to use

The UI is bilingual. Switch between **English** and **日本語** with the language selector in the top-right header. Labels below mention both versions where relevant.

### Layout overview

- **Header** (icon-only, with tooltips): language selector, **New** (新規作成), **Import** (インポート), **Export** (エクスポート).
- **Left pane** (collapsible accordion sections):
  1. **Logic Name** (ロジック名) — inline-editable.
  2. **Table Graph** (テーブル関係図) — DAG of tables with Continue references.
  3. **Tables** (テーブル一覧) — flat list with delete + add.
  4. **Field Definitions** (フィールド定義) — shared field catalog with its own JSON import/export.
- **Right pane**: the **table editor** for the selected table.
- **Bottom drawer**: the **Evaluation Panel** (評価パネル) — collapse/expand by clicking the header. Tabs: Single (単一評価) and Batch (バッチ評価).

The accordion open/close state and the drawer state are persisted to `localStorage`.

---

### 1. Define fields

Open the **Field Definitions** (フィールド定義) accordion in the left pane.

1. Type a field name in the text box at the bottom of the section.
2. Choose a type from the dropdown.
3. Click the **＋** button (or press Enter).

| Type (EN / 日本語) | Description |
|---|---|
| `Text` / `テキスト` (string) | Free-form text. Supports `=`, `!=`, `in`, `contains`, `starts_with`, `ends_with`. |
| `Number` / `数値` (number) | Numeric. Supports `=`, `!=`, `<`, `<=`, `>`, `>=`, `between`. |
| `Boolean` / `真偽値` (bool) | `true` / `false`. |
| `Enum` / `選択肢` (enum) | A predefined list of values. Add choices inline using the tag editor inside each enum field. |
| `Date` / `日付` (date) | ISO 8601 date. Supports relative operators like `before_today`, `after_today`. |
| `Datetime` / `日時` (datetime) | ISO 8601 date-time. |

**Changing a field's type** resets all condition cells that reference it (a confirmation dialog is shown if any cells exist).
**Deleting a field** is blocked if any condition column still references it.

#### Field-definition import / export

The Field Definitions section header has its own ⬆ / ⬇ buttons that import and export **just** the field catalog as JSON (separate from the logic JSON). This is useful for reusing the same fields across multiple logics. The file format is:

```json
{
  "version": "1",
  "fields": [
    { "name": "Customer Type", "type": "enum", "enumValues": ["Corp", "Individual"] },
    { "name": "Amount",        "type": "number" }
  ]
}
```

Importing skips fields whose names already exist in the current logic.

---

### 2. Build a table

#### Add a condition column

Click **＋ Add condition column** (＋ 条件列を追加) below the table. Then choose a field from the dropdown in the column header.

#### Add a row

Click **＋ Add row** (＋ 行を追加) below the table.

#### Edit a condition cell

Click any cell in the condition area to open a popup:

1. Choose an **operator** from the dropdown (the list is filtered by the column's field type).
2. Enter a **value** using the appropriate input (text, number, date picker, checkbox list, etc.).
3. Click **Set** (設定) to save, or **No condition (wildcard)** (条件なし（ワイルドカード）) to make the cell match anything.

The cell displays a compact summary (`>= 100`, `Corp, Individual`, `(no condition)`, etc.).

#### Edit a conclusion

Click the **Conclusion** (結論) cell to open a popup:

- **Terminal** (終端結論) — fill in the output value for each output column.
- **Continue** (継続参照) — pick the target table from the dropdown. Tables that would create a cycle are marked and disabled.

#### Reorder rows

Drag the grip handle (⠿) on the left of each row, or use the ▲ / ▼ arrow buttons.

#### Manage output columns

Click the ⚙ icon in the conclusion column header to add, rename, or delete output columns. A table must always have at least one output column.

#### Switch between Table and Flowchart view

Each table has a tab switcher in its header:

- **Table** (テーブル) — the rows-and-cells editor.
- **Flowchart** (フローチャート) — an automatically generated flowchart of the table's rules. Branches that have no matching rule are shown as **phantom nodes** (`No rule` / 未対応) so you can spot coverage gaps visually. Click a node to jump back to the corresponding row in the Table view. Available for tables built from `enum` / `bool` fields where coverage can be analysed exhaustively.

When coverage gaps exist, a yellow banner appears below the table with a shortcut to the Flowchart view.

---

### 3. Manage tables

The **Table Graph** (テーブル関係図) accordion shows a DAG of how tables reference each other. The **Tables** (テーブル一覧) accordion shows them as a flat list.

| Action | How |
|--------|-----|
| Add a table | Click **＋ Add table** (＋ テーブルを追加) at the bottom of the Tables list. |
| Switch to a table | Click its name in the list, or click its node in the DAG graph. |
| Rename a table | Click the table name in the editor header (inline edit). |
| Set as entry table | Click **Set as entry** (入口に設定) next to the table name in the editor header. |
| Delete a table | Hover the table name in the list and click 🗑. Blocked if other tables reference it or if it is the entry table. |

The DAG graph shows:
- **▶ Entry badge** — the current entry table.
- Directed edges — *Continue* references between tables.
- Tables not reachable from the entry table appear as orphans.

---

### 4. Evaluate

The **Evaluation Panel** (評価パネル) is a collapsible drawer at the bottom of the right pane. It has two tabs:

#### Single (単一評価)

1. Enter values for each field in the input form.
2. Click **Evaluate** (評価実行).
3. The result appears with a step-by-step **trace** showing which rows were checked, which were skipped, and why.

Click **Reset** (リセット) to clear all inputs and the result.

#### Batch (バッチ評価)

Run many test cases in one shot from a CSV.

1. Click **Download template** (テンプレートをダウンロード) to get a CSV pre-populated with the current logic's field names and `期待:<output>` columns.
2. Fill the CSV in Excel / Google Sheets (UTF-8 BOM, RFC 4180 quoting).
3. Click **Load CSV** (CSVを読み込む) to load the cases, then **Run all** (すべて評価実行).
4. Each case is shown with its result and (if expected values were provided) a Pass / Fail badge. Click a row to expand its trace.

CSV header conventions:

| Column | Header value |
|---|---|
| Case name | `ケース名` (optional — auto-numbered if absent) |
| Input value | exact field name from the logic |
| Expected value | `期待:<output column name>` |

---

### 5. Save, export, and import

- **Auto-save** — the logic is saved to `localStorage` (key `decision-table-editor-v2`) on every change. It is restored automatically on next load.
- **Export** — click the ⬇ button in the header to download the logic as `<logic name>.json`.
- **Import** — click the ⬆ button to load a `.json` file. The file is validated with a Zod schema. Minor issues (broken Continue references, missing output columns, stale ID counters) are repaired automatically with a notification.

#### JSON format (v2)

```json
{
  "version": "2",
  "name": "Loan Review",
  "entryTableId": "t1",
  "fieldDefs": {
    "f1": { "id": "f1", "name": "Customer Type", "type": "enum", "enumValues": ["Corp", "Individual"] },
    "f2": { "id": "f2", "name": "Amount", "type": "number" }
  },
  "tables": {
    "t1": {
      "id": "t1",
      "name": "Initial Review",
      "cols": [{ "id": "c1", "fieldId": "f1" }, { "id": "c2", "fieldId": "f2" }],
      "outputCols": [{ "id": "oc1", "name": "Result" }],
      "rows": [
        {
          "id": "r1",
          "cells": { "c1": { "op": "=", "val": "Corp" }, "c2": { "op": ">=", "val": "1000000" } },
          "conclusion": { "type": "terminal", "outputs": { "oc1": "Approve" } }
        },
        {
          "id": "r2",
          "cells": {},
          "conclusion": { "type": "terminal", "outputs": { "oc1": "Reject" } }
        }
      ]
    }
  },
  "nField": 3, "nTable": 2, "nCol": 3, "nOCol": 2, "nRow": 3
}
```

---

### 6. Use your logic from an LLM (MCP)

Once a logic is exported as JSON, you can expose it to Claude Desktop, Cursor, Cline, VS Code (Copilot agent mode), or any other [Model Context Protocol](https://modelcontextprotocol.io/) client via the **`leverie-mcp`** CLI:

```bash
# One file → one MCP tool
npx leverie-mcp serve /absolute/path/to/my-logic.json

# A directory → every *.json becomes its own tool
npx leverie-mcp serve /absolute/path/to/logics/
```

You don't run this in a terminal day-to-day — you add it to your MCP client's config and the client spawns it on demand. Per-client setup snippets (Claude Desktop / Cursor / Cline / VS Code / Claude Code), an end-to-end verification recipe, and a troubleshooting table live in [apps/mcp-server/README.md](apps/mcp-server/README.md).

Three ready-to-run sample logics live in [examples/](examples/) — point your client at that directory and you immediately get a `loan_review`, `support_ticket_routing`, and `refund_eligibility` tool with worked LLM prompts.

A prebuilt Docker image is published to GitHub Container Registry as `ghcr.io/remi0753/leverie-mcp` for setups where `npx` isn't an option.

---

## Tech stack

| Category | Library |
|----------|---------|
| Framework | React 18 |
| Language | TypeScript 5 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| State management | Zustand 4 |
| Graph visualization | @xyflow/react + dagre |
| Drag & drop | @dnd-kit |
| Date input | react-datepicker |
| Icons | lucide-react |
| Notifications | sonner |
| Schema validation | Zod |
| Lint / format | Biome |
| Hosting | Cloudflare Workers (Wrangler) |

---

## Specification documents

The full design specification lives in [doc/](doc/) (Japanese). Start at [doc/README.md](doc/README.md) for the table of contents.

---

## License

LEVERIE uses a **mixed-license** setup so that the libraries you embed in your own systems stay permissive, while the editor and cloud backend are protected against being re-hosted as a competing managed service.

| Path | License | What it means |
|---|---|---|
| `packages/engine/` `packages/checks/` `packages/schema/` `packages/ui-runtime/` | **Apache License 2.0** | True OSS. Embed, modify, ship inside commercial products freely. |
| `apps/mcp-server/` (npm: `leverie-mcp`) | **Apache License 2.0** | Same as above. Run `npx leverie-mcp` in any context, including commercial deployments. |
| `apps/editor/` `apps/api/` and the repository as a whole | **[Functional Source License 1.1, ALv2 Future License (FSL-1.1-ALv2)](https://fsl.software/)** | Source-available. Free to read, modify, and self-host for your own internal use (including inside a company). Prohibited: making the software available to third parties as a commercial product or service that competes with LEVERIE. **Automatically converts to Apache License 2.0 two years after each release.** |

If you want a managed/hosted LEVERIE without standing it up yourself, use **[leverie.dev](https://leverie.dev)** (paid plans). Otherwise, self-hosting under FSL is free for any non-competing use.

Each directory contains its own `LICENSE` file with the authoritative text. The root [LICENSE](LICENSE) is FSL-1.1-ALv2 with an explicit scope clause carving out the Apache-2.0 directories listed above.
