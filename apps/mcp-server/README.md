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
| **name** | `loan_review` (slugified from the logic name) |
| **description** | `logic.description`, or a generated fallback |
| **inputSchema** | JSON Schema derived from `fieldDefs` — one optional property per field, typed (`number`/`boolean`/`enum`/`string`/`date`/`datetime`) |
| **outputSchema** | `{ status: 'ok' \| 'no_match', outputs?, tableId? }` |

Calling the tool runs the Logic through `@leverie/engine`'s `evaluateLogicByName` and returns the matched conclusion (`status: 'ok'`) or `no_match` if no row fired.

## How it relates to other packages

| Package | Role |
|---|---|
| [`@leverie/engine`](../../packages/engine) | Evaluates the Logic. `leverie-mcp` is a thin wrapper around it. |
| [`@leverie/schema`](../../packages/schema) | Generates the JSON Schema and Zod shapes that the MCP tool exposes. |
| [`@leverie/checks`](../../packages/checks) | Optional health-check pass (not yet wired into the CLI; planned for P1.5). |

## Status

P1.3 (Standalone MCP, single-file + directory + `--watch`). Docker image and tool-annotation polish land in P1.4–P1.5. See [roadmap.md](https://github.com/remi0753/leverie/blob/main/doc/roadmap.md).

## License

Apache-2.0.
