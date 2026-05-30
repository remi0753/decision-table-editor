<p align="center">
  <img src="apps/editor/src/assets/logo.svg" alt="LEVERIE" height="56" />
  <h1 align="center">LEVERIE</h1>
  <p align="center">
    Build, verify, and ship <strong>decision logic</strong> — entirely in the browser, no code required. Then call it from your apps and from LLM agents over MCP.
  </p>
</p>

---

## Name

**Pronunciation:** /lɛvəˈrie/ · レヴァリエ

The name is inspired by *reverie* — a state of pleasant, effortless thought. The leading **L** reflects the tool's core purpose: **Logic**. Together, LEVERIE evokes the idea of navigating complex decision logic as naturally as a train of thought.

The Japanese reading is a respectful nod to ZUN of [Team Shanghai Alice](https://www16.big.or.jp/~zun/).

---

## Concept

Business rules — "if the customer is X and the amount is over Y, then Z" — usually end up buried in code, spreadsheets, or sprawling flowcharts. They become hard to read, risky to change, and impossible to verify without a developer. **LEVERIE turns those rules into Excel-style decision tables that anyone can author, review, and run.**

### Three things LEVERIE does for you

**1. Write logic in a GUI — not in code.**
You build rules as tables of conditions and conclusions, point-and-click. There is no DSL to learn and no code to write or deploy. A logic is just a graph of tables that reads top-to-bottom, like a spreadsheet you can reason about.

**2. Verify and review everything in the UI.**
The editor continuously checks your tables for **duplicate, unreachable, and missing rules**, and visualizes coverage gaps as a flowchart. You can evaluate inputs interactively with a **step-by-step trace**, batch-test hundreds of cases from a CSV, and — before publishing — review a **side-by-side diff** of exactly what changed against the live version. No more guessing whether an edit broke something.

**3. Expose your logic as a callable interface — for apps and for AI agents.**
A published logic is more than a document: it becomes a live endpoint with a typed input/output schema. Call it from your own services over the **Evaluate API**, or let an LLM agent invoke it directly through the hosted **[Model Context Protocol](https://modelcontextprotocol.io/) (MCP)** endpoint — each logic shows up as a ready-to-use tool. Your decision rules become a single source of truth that humans and agents share.

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
  api/               # hosted API + hosted MCP worker
  docs/              # documentation site
packages/            # Importable libraries
  engine/            # @leverie/engine — evaluation engine
  checks/            # @leverie/checks — quality checks
  schema/            # @leverie/schema — JSON Schema generation
```

**Role split:** `apps/*` are deployable products — the editor, hosted API / MCP worker, and docs site. `packages/*` are pure libraries consumed via `import` (publishable to npm as `@leverie/*`).

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

## Documentation

This README focuses on the **concept** and on **running the project locally**. The full user guide — defining fields, building tables, evaluating, batch testing, publishing, the JSON format, and the API / MCP reference — lives on the docs site:

**👉 [leverie.dev/docs](https://leverie.dev/docs)**

The UI is fully bilingual (English / 日本語); switch with the language selector in the top-right header.

### Quick taste: call a published logic from an agent

Once a logic is published in LEVERIE Cloud, it is reachable over the hosted [Model Context Protocol](https://modelcontextprotocol.io/) endpoint, so an LLM agent can list and call it as a tool:

```bash
curl https://leverie.dev/v1/mcp \
  -H "Authorization: Bearer lvr_your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Each published logic becomes one callable tool, with input/output schemas generated from `@leverie/schema`. Hosted MCP shares the same API keys as the Evaluate API. Three sample logics live in [examples/](examples/) — `loan_review`, `support_ticket_routing`, and `refund_eligibility` — for import, publishing, and MCP tool-call demos.

See the full reference at **[leverie.dev/docs](https://leverie.dev/docs)**.

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

## Design & specification documents

Contributor-facing design and behavioral specs live in [doc/](doc/) (Japanese): the data model, evaluation/quality-check contracts that `@leverie/*` implement, and the Cloud Foundation schema/infrastructure design. Start at [doc/README.md](doc/README.md). End-user usage is documented separately at [leverie.dev/docs](https://leverie.dev/docs).

---

## License

LEVERIE uses a **mixed-license** setup so that the libraries you embed in your own systems stay permissive, while the editor and cloud backend are protected against being re-hosted as a competing managed service.

| Path | License | What it means |
|---|---|---|
| `packages/engine/` `packages/checks/` `packages/schema/` `packages/ui-runtime/` | **Apache License 2.0** | True OSS. Embed, modify, ship inside commercial products freely. |
| `apps/docs/` | **Apache License 2.0** | Documentation site. Reuse, translate, and quote freely. |
| `apps/editor/` `apps/api/` and the repository as a whole | **[Functional Source License 1.1, ALv2 Future License (FSL-1.1-ALv2)](https://fsl.software/)** | Source-available. Free to read, modify, and self-host for your own internal use (including inside a company). Prohibited: making the software available to third parties as a commercial product or service that competes with LEVERIE. **Automatically converts to Apache License 2.0 two years after each release.** |

If you want a managed/hosted LEVERIE without standing it up yourself, use **[leverie.dev](https://leverie.dev)** (paid plans). Otherwise, self-hosting under FSL is free for any non-competing use.

Each directory contains its own `LICENSE` file with the authoritative text. The root [LICENSE](LICENSE) is FSL-1.1-ALv2 with an explicit scope clause carving out the Apache-2.0 directories listed above.
