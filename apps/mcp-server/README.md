# leverie-mcp

> Standalone [MCP](https://modelcontextprotocol.io/) server for [LEVERIE](https://github.com/remi0753/leverie) decision logic.

Expose a Logic JSON file (exported from the LEVERIE editor) as MCP tools that any MCP client — Claude Desktop, Cursor, Cline — can call.

## Quick start

```bash
npx leverie-mcp serve ./my-logic.json
```

The command speaks the [Model Context Protocol](https://modelcontextprotocol.io/) over **stdio**. You don't run it directly in a terminal for normal use — you wire it up in your MCP client's config and the client spawns it on demand.

## Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "loan-review": {
      "command": "npx",
      "args": ["-y", "leverie-mcp", "serve", "/absolute/path/to/loan-review.json"]
    }
  }
}
```

Then ask Claude: "Use the loan_review tool to decide whether a Corp customer borrowing 1,500,000 should be approved."

## Cursor / Cline

Equivalent `mcpServers` blocks in their respective config files. See the [Phase 1.6 docs](https://github.com/remi0753/leverie/blob/main/doc/roadmap.md) once published for full client setup snippets.

## CLI

```
leverie-mcp serve <file>          Expose a Logic JSON file as MCP tools over stdio
leverie-mcp --version             Print version
leverie-mcp --help                Print this help

Options for "serve":
  --strict                        Reserved for P1.3 (directory mode), where it will
                                  toggle skip-and-warn vs fail-fast across files.
                                  Single-file mode (P1.2) always fails on a bad file.
```

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

P1.2 (Standalone MCP, single-file mode). Multi-logic directories, Docker image, and tool annotations land in P1.3–P1.5. See [roadmap.md](https://github.com/remi0753/leverie/blob/main/doc/roadmap.md).

## License

Apache-2.0.
