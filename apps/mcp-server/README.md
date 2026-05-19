# leverie-mcp

> Standalone [MCP](https://modelcontextprotocol.io/) server for [LEVERIE](https://github.com/remi0753/leverie) decision logic.

Expose a Logic JSON file (exported from the LEVERIE editor) — or an entire directory of them — as MCP tools that any MCP client (Claude Desktop, Cursor, Cline) can call.

## Quick start

```bash
# Single file: one MCP tool
npx leverie-mcp serve ./my-logic.json

# Directory: every *.json becomes its own tool
npx leverie-mcp serve ./logics/
```

The command speaks the [Model Context Protocol](https://modelcontextprotocol.io/) over **stdio**. You don't run it directly in a terminal for normal use — you wire it up in your MCP client's config and the client spawns it on demand.

## Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "leverie": {
      "command": "npx",
      "args": ["-y", "leverie-mcp", "serve", "/absolute/path/to/logics/"]
    }
  }
}
```

Then ask Claude: "Use the loan_review tool to decide whether a Corp customer borrowing 1,500,000 should be approved."

## Cursor / Cline

Equivalent `mcpServers` blocks in their respective config files. See the Phase 1.6 docs once published for full client setup snippets.

## Docker

A prebuilt image is published to GitHub Container Registry:

```bash
docker pull ghcr.io/remi0753/leverie-mcp:latest
```

Tags: `latest`, full semver (`0.1.0`), major.minor (`0.1`), `edge` (head of `main`).

Wire it into an MCP client the same way as the `npx` variant, but spawn `docker run` instead. Pass `-i` so stdin stays attached, mount your logic files read-only, and let the container exit when the client disconnects:

```json
{
  "mcpServers": {
    "leverie": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "/absolute/path/to/logics:/logics:ro",
        "ghcr.io/remi0753/leverie-mcp:latest"
      ]
    }
  }
}
```

The default `CMD` is `serve /logics`, so a directory mount under `/logics` is all that's needed. To serve a single file, mount it explicitly and override the command:

```json
"args": [
  "run", "-i", "--rm",
  "-v", "/absolute/path/to/loan.json:/logics/loan.json:ro",
  "ghcr.io/remi0753/leverie-mcp:latest",
  "serve", "/logics/loan.json"
]
```

Image is single-arch (`linux/amd64`). On Apple Silicon, Docker runs it under Rosetta/QEMU emulation — fine for a stdio MCP server but slower to start; native `npx leverie-mcp` is preferable in that case.

### Building locally

```bash
docker build -f apps/mcp-server/docker/Dockerfile -t leverie-mcp:dev .
```

The build runs from the repository root (it needs the workspace `pnpm-lock.yaml` and the source of the `@leverie/engine` / `@leverie/schema` packages). Everything Docker-specific lives under [`apps/mcp-server/docker/`](./docker/).

## CLI

```
leverie-mcp serve <path>          Expose a Logic JSON file, or every *.json
                                  file in a directory, as MCP tools over stdio
leverie-mcp --version             Print version
leverie-mcp --help                Print this help

Options for "serve":
  --strict                        Fail fast on any unreadable/invalid file or
                                  duplicate tool name. Default: skip with a
                                  warning on stderr and serve the rest.
  --watch                         Re-scan and re-register tools when files
                                  change. Connected MCP clients are notified
                                  via tools/list_changed.
```

### Directory mode

Directory scans are **non-recursive**: only `*.json` files directly inside the given directory are loaded. Nested directories are ignored — keep all logic files in one flat folder. (Workspace concepts arrive in Phase 3.)

Each file produces one tool, named via `logicNameToToolSlug(logic.name)` from [`@leverie/schema`](../../packages/schema). If two files slug to the same tool name, that's a **slug collision**:

- `--strict`: the server fails immediately with both file paths in the error.
- default: the first file wins, the rest are skipped with a stderr warning. Rename one of the logics to disambiguate.

If every file fails to load (or the directory has no `*.json` files), the server still aborts — an MCP server with zero registered tools cannot answer `tools/list`.

### `--watch`

Hot-reload for local development. Saves to any watched `*.json` trigger a debounced re-scan; the SDK fires `tools/list_changed` automatically and connected clients refresh their tool lists. Reload errors are non-fatal: the previous tool set keeps serving until the next save fixes things.

`--watch` is intended for development. Production deployments should leave it off and restart the server on intentional changes.

## What gets exposed

For a Logic with `name: "Loan Review"`, you get one MCP tool:

| | |
|---|---|
| **name** | `loan_review` — slugified from the logic name. camelCase / PascalCase / acronyms are split (`HTTPServer` → `http_server`), digit-leading names are prefixed (`2024Review` → `tool_2024_review`), and the result is capped at 64 chars. |
| **description** | `logic.description` (if set) followed by an auto-generated **Inputs** list (every field with its type / enum values) and an **Outputs** list (union of all output column names). This is what an LLM reads to decide whether to call the tool. |
| **inputSchema** | JSON Schema derived from `fieldDefs` — one optional property per field, typed (`number`/`boolean`/`enum`/`string`/`date`/`datetime`) |
| **outputSchema** | `{ status: 'ok' \| 'no_match', outputs?, unmatchedTable?, trace }` |

Calling the tool runs the Logic through `@leverie/engine`'s `evaluateLogicByName` and returns the matched conclusion (`status: 'ok'`) or `no_match` if no row fired. Either way, `structuredContent` includes a `trace` array shaped for LLM / human consumption:

- Tables appear by **name**, not internal `t1` ID
- Rows appear by **1-based index** (matching the editor UI), not internal `r1` ID
- The column that caused a skipped row appears as its **field name**, not internal `c1` / `oc2` ID

```jsonc
// status: ok
{
  "status": "ok",
  "outputs": { "Decision": "Approve", "Reason": "Large corporate loan" },
  "trace": [
    {
      "table": "Review",
      "depth": 0,
      "matchedRow": { "index": 1, "conclusion": "terminal" },
      "skippedRows": []
    }
  ]
}
```

## How it relates to other packages

| Package | Role |
|---|---|
| [`@leverie/engine`](../../packages/engine) | Evaluates the Logic. `leverie-mcp` is a thin wrapper around it. |
| [`@leverie/schema`](../../packages/schema) | Generates the JSON Schema and Zod shapes that the MCP tool exposes, plus the LLM-friendly tool description and trace formatter. |
| [`@leverie/checks`](../../packages/checks) | Standalone health-check helpers (not yet wired into the CLI). |

## Status

P1.5 (Standalone MCP, single-file + directory + `--watch` + GHCR Docker image + slug / description / trace polish). See [roadmap.md](https://github.com/remi0753/leverie/blob/main/doc/roadmap.md).

## License

Apache-2.0.
