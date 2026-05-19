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

## Prerequisites

- **Node.js 18+** on your `PATH`. `npx` ships with Node.
- A Logic JSON file exported from the [LEVERIE editor](https://github.com/remi0753/leverie) — or a directory of them. Use an **absolute path** in every config snippet below: MCP clients spawn the server from their own working directory, and relative paths usually resolve somewhere unexpected.
- No prior `npm install` step required: `npx -y leverie-mcp` fetches and caches the latest version automatically. Pin a version (`leverie-mcp@0.1.0`) for reproducible setups.

> **Don't have a logic file yet?** Point your client at [`examples/`](../../examples/) in this repo — three ready-to-run samples (loan review, support ticket routing, refund eligibility) with worked LLM prompts.

## Connect from your LLM client

Every snippet below wires up the same shape — `command` + `args` for a stdio MCP server. Pick your client; the config locations differ but the JSON body is essentially identical.

### Claude Desktop

Config file:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Open the file (create it if missing) and add a `leverie` entry under `mcpServers`:

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

**Fully quit and reopen Claude Desktop** (closing the window is not enough — quit from the menu / tray). The hammer icon in the chat input should now list one tool per `*.json` in the directory.

Try it: *"Use the `loan_review` tool to decide whether a Corp customer borrowing 1,500,000 with a guarantor should be approved."*

### Cursor

Cursor reads MCP server config from a `mcp.json` file. Use **project scope** when the logic file is checked into a specific repo, or **global scope** to share one set of tools across every project:

| Scope | Path |
|---|---|
| Project | `<repo-root>/.cursor/mcp.json` |
| Global (user) | `~/.cursor/mcp.json` |

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

Open **Cursor Settings → MCP** to confirm the server is `enabled` and the tools are listed. In **Agent mode** ask the model to call `loan_review`.

### Cline (VS Code extension)

In VS Code, open the Cline side panel → **MCP Servers** tab → **Configure MCP Servers** (gear icon). That opens `cline_mcp_settings.json`:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Windows | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` |
| Linux | `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |

```json
{
  "mcpServers": {
    "leverie": {
      "command": "npx",
      "args": ["-y", "leverie-mcp", "serve", "/absolute/path/to/logics/"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Save the file — Cline picks up the change without a reload. The MCP Servers panel shows a green dot per active server and lists its tools.

> **VS Code Insiders / different editor build**: substitute `Code - Insiders` / `VSCodium` for `Code` in the path above.

### VS Code (GitHub Copilot agent mode)

VS Code's built-in MCP support reads `.vscode/mcp.json` from the open workspace:

```json
{
  "servers": {
    "leverie": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "leverie-mcp", "serve", "/absolute/path/to/logics/"]
    }
  }
}
```

Reload the window (`Developer: Reload Window`) and open **Chat → Agent**. The tools picker lists every Logic.

### Claude Code (CLI)

One command registers the server in your user-level `~/.claude.json`:

```bash
claude mcp add leverie --scope user -- npx -y leverie-mcp serve /absolute/path/to/logics/
```

Use `--scope project` instead to write to `.mcp.json` in the current repo (checked in for the whole team). Verify with `claude mcp list`.

### Any other stdio MCP client

The wire format is the standard Model Context Protocol. The minimum a client needs to know is:

- **Transport**: stdio
- **Command**: `npx -y leverie-mcp serve <absolute-path>`
- **Working directory**: irrelevant (paths in args are absolute)
- **Environment**: none required

## Verifying the setup

If a client doesn't expose a "list tools" view, two quick smoke tests confirm the server itself is healthy. Both run outside the client and don't require any LLM.

**1. The server starts and lists tools.** From a terminal:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | npx -y leverie-mcp serve /absolute/path/to/logics/
```

You should see a JSON-RPC response whose `result.tools[]` contains one entry per `*.json` file.

**2. Calling a tool returns a verdict.** Pipe a `tools/call` request:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"loan_review","arguments":{"Customer Type":"Corp","Amount":1500000,"Has Guarantor":true}}}' \
  | npx -y leverie-mcp serve /absolute/path/to/logics/loan-review.json
```

The response's `structuredContent` should report `status: "ok"` with the matched outputs and a `trace` array.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Client shows no `leverie` tools | Config didn't reload | Fully quit and relaunch the client (Claude Desktop especially — the tray/menu icon must close). Reload window for VS Code / Cursor. |
| `ENOENT: spawn npx` in client logs | `npx` not on the PATH the client inherits | Use an absolute path to `npx` (e.g. `/usr/local/bin/npx` on macOS, the output of `which npx`). On Windows, install Node into the system PATH rather than per-user. |
| `Cannot find logic file` | Relative path | Use an **absolute path** in `args`. MCP clients don't run from your shell's `cwd`. |
| `slug collision` error on startup | Two `*.json` files in the directory produce the same tool name | Rename one of the logics (the `name` field), or load only one file with `serve /path/to/one.json`. |
| `server exited with code 1` immediately on startup | The single file failed to parse | Run the same `serve` command in a terminal — the parse error prints to stderr. Or pass `--strict` to surface validation failures with the file path. |
| Tools appear but calls return `no_match` for every input | Field names in the call don't match the Logic's `fieldDefs[].name` (the schema is case-sensitive and preserves spaces) | Check `tools/list` and use the exact names from `inputSchema.properties`. |
| Server picks up an old version of the logic | `npx` cache or stale process | `npx leverie-mcp@latest …` or use `--watch` in dev. |

Client-specific logs (handy when something doesn't appear in the UI):

- **Claude Desktop**: `~/Library/Logs/Claude/mcp*.log` (macOS), `%APPDATA%\Claude\logs\mcp*.log` (Windows)
- **Cline**: VS Code Output panel → "Cline" channel
- **Cursor**: Help → Toggle Developer Tools → Console
- **VS Code**: Output panel → "MCP" channel

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

P1.7 (Standalone MCP — single-file + directory + `--watch` + GHCR Docker image + slug / description / trace polish + per-client setup docs + worked sample logics under [`examples/`](../../examples/)). See [roadmap.md](https://github.com/remi0753/leverie/blob/main/doc/roadmap.md).

## License

Apache-2.0.
