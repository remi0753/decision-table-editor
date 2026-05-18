import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadLogicFile } from './load-logic.js';
import { createServer, registerLogicTool } from './make-server.js';

export interface ServeOptions {
  /** Path to the Logic JSON file to expose. */
  filePath: string;
  /**
   * Reserved for P1.3 (directory mode), where it will toggle skip-and-warn
   * vs fail-fast across multiple files. In P1.2 single-file mode the only
   * coherent behavior on a bad file is fail-fast — a server with zero tools
   * cannot respond to `tools/list` (the SDK wires that handler lazily on the
   * first `registerTool`).
   */
  strict?: boolean;
  /** Defaults to writing a single line to stderr. Override for tests. */
  log?: (message: string) => void;
}

export interface ServeResult {
  server: McpServer;
  toolCount: number;
}

/**
 * Build an MCP server for the given Logic file and connect it to stdio.
 *
 * P1.2 is single-file: one tool per server. P1.3 will extend this to a
 * directory of files; `createServer` + `registerLogicTool` are exported from
 * `make-server.ts` to make that extension a loop, not a rewrite.
 */
export async function serve(options: ServeOptions): Promise<ServeResult> {
  const log = options.log ?? defaultLog;

  const logic = await loadLogicFile(options.filePath);
  const server = createServer();
  registerLogicTool(server, logic);
  log(`[leverie-mcp] loaded ${options.filePath} (tool: ${logic.name})`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('[leverie-mcp] serving 1 tool on stdio');

  return { server, toolCount: 1 };
}

function defaultLog(message: string): void {
  process.stderr.write(`${message}\n`);
}
