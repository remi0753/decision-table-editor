export const HELP_TEXT = `leverie-mcp — Standalone MCP server for LEVERIE decision logic

Usage:
  leverie-mcp serve <file>          Expose a Logic JSON file as MCP tools over stdio
  leverie-mcp --version             Print version
  leverie-mcp --help                Print this help

Options for "serve":
  --strict                          Reserved for P1.3 (directory mode). In single-file
                                    mode the CLI always fails on validation errors.

Examples:
  npx leverie-mcp serve ./my-logic.json
  npx leverie-mcp serve ./loan-review.json --strict

MCP client setup (Claude Desktop / Cursor / Cline) — see the README.
`;

export interface ParsedArgs {
  kind: 'help' | 'version' | 'serve' | 'error';
  filePath?: string;
  strict?: boolean;
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

  let filePath: string | undefined;
  let strict = false;
  for (const arg of argv.slice(1)) {
    if (arg === '--help' || arg === '-h') return { kind: 'help' };
    if (arg === '--strict') {
      strict = true;
      continue;
    }
    if (arg.startsWith('-')) {
      return { kind: 'error', message: `Unknown flag: ${arg}` };
    }
    if (filePath !== undefined) {
      return {
        kind: 'error',
        message: `Unexpected extra argument: ${arg} (P1.3 will add directory support; for now pass a single Logic JSON file)`,
      };
    }
    filePath = arg;
  }

  if (!filePath) {
    return {
      kind: 'error',
      message: 'serve requires a Logic JSON file path',
    };
  }

  return { kind: 'serve', filePath, strict };
}
