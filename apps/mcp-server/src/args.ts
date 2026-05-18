export const HELP_TEXT = `leverie-mcp — Standalone MCP server for LEVERIE decision logic

Usage:
  leverie-mcp serve <path>          Expose a Logic JSON file, or every *.json file
                                    in a directory, as MCP tools over stdio
  leverie-mcp --version             Print version
  leverie-mcp --help                Print this help

Options for "serve":
  --strict                          Fail fast on any unreadable/invalid file or
                                    duplicate tool name. Default: skip with a
                                    warning on stderr and serve the rest.
                                    (Single-file mode always fails on a bad
                                    file — an empty server can't reply to
                                    tools/list.)
  --watch                           Re-scan and re-register tools when files
                                    change. Connected MCP clients are notified
                                    via tools/list_changed.

Examples:
  npx leverie-mcp serve ./my-logic.json
  npx leverie-mcp serve ./logics/
  npx leverie-mcp serve ./logics/ --strict --watch

MCP client setup (Claude Desktop / Cursor / Cline) — see the README.
`;

export interface ParsedArgs {
  kind: 'help' | 'version' | 'serve' | 'error';
  path?: string;
  strict?: boolean;
  watch?: boolean;
  message?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) return { kind: 'help' };

  const first = argv[0];
  if (first === '--help' || first === '-h') return { kind: 'help' };
  if (first === '--version' || first === '-v') return { kind: 'version' };

  if (first !== 'serve') {
    return { kind: 'error', message: `Unknown command: ${first}` };
  }

  let path: string | undefined;
  let strict = false;
  let watch = false;
  for (const arg of argv.slice(1)) {
    if (arg === '--help' || arg === '-h') return { kind: 'help' };
    if (arg === '--strict') {
      strict = true;
      continue;
    }
    if (arg === '--watch') {
      watch = true;
      continue;
    }
    if (arg.startsWith('-')) {
      return { kind: 'error', message: `Unknown flag: ${arg}` };
    }
    if (path !== undefined) {
      return {
        kind: 'error',
        message: `Unexpected extra argument: ${arg} (pass a single file or directory; nested directories are not scanned)`,
      };
    }
    path = arg;
  }

  if (!path) {
    return {
      kind: 'error',
      message: 'serve requires a path to a Logic JSON file or a directory',
    };
  }

  return { kind: 'serve', path, strict, watch };
}
