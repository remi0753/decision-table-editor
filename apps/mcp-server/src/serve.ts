import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './make-server.js';
import {
  type LoadAndRegisterOptions,
  loadAndRegisterPath,
  type RegistrationLog,
} from './register.js';
import { classifyPath } from './scan-directory.js';
import { startWatcher, type Watcher } from './watch.js';

export interface ServeOptions {
  /** Path to a Logic JSON file or a directory containing *.json logics. */
  path: string;
  /**
   * Fail fast on the first bad file or duplicate tool slug. Default off:
   * bad files are logged to stderr and skipped. A server with zero tools
   * is always an error — the SDK wires `tools/list` lazily on the first
   * `registerTool` call.
   */
  strict?: boolean;
  /**
   * Re-scan and re-register tools when the underlying file or directory
   * changes. Connected clients receive `tools/list_changed` automatically
   * via the SDK.
   */
  watch?: boolean;
  /** Defaults to writing a single line to stderr. Override for tests. */
  log?: (message: string) => void;
}

export interface ServeResult {
  server: McpServer;
  toolCount: number;
  /** Present when `watch: true`. Call `.stop()` to tear it down. */
  watcher?: Watcher;
}

/**
 * Build an MCP server for a Logic file or directory and connect it to stdio.
 *
 * Single-file vs directory is decided by `fs.stat`. The shape of the registry
 * after this returns is captured in `toolCount`; the live mutation surface
 * (for `--watch`) lives in `register.ts`.
 */
export async function serve(options: ServeOptions): Promise<ServeResult> {
  const log = options.log ?? defaultLog;
  const registerOpts: LoadAndRegisterOptions = {
    strict: options.strict,
    log,
  };

  const server = createServer();
  const initial = await loadAndRegisterPath(server, options.path, registerOpts);

  const kind = await classifyPath(options.path);
  logInitialSummary(log, options.path, kind, initial);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  let watcher: Watcher | undefined;
  if (options.watch) {
    watcher = await startWatcher({
      server,
      path: options.path,
      kind,
      registry: initial.registered,
      registerOpts,
      log,
    });
    log(
      `[leverie-mcp] watching ${options.path} for changes (tools/list_changed will fire on reload)`,
    );
  }

  return { server, toolCount: initial.registered.size, watcher };
}

function logInitialSummary(
  log: (message: string) => void,
  path: string,
  kind: 'file' | 'directory',
  result: RegistrationLog,
): void {
  if (kind === 'file') {
    log(`[leverie-mcp] serving 1 tool on stdio (${path})`);
    return;
  }
  const count = result.registered.size;
  const slugs = Array.from(result.registered.keys()).join(', ');
  log(
    `[leverie-mcp] serving ${count} tool${count === 1 ? '' : 's'} on stdio from ${path}: ${slugs}`,
  );
  if (result.skipped.length > 0) {
    log(
      `[leverie-mcp] ${result.skipped.length} file${result.skipped.length === 1 ? '' : 's'} skipped (see warnings above)`,
    );
  }
}

function defaultLog(message: string): void {
  process.stderr.write(`${message}\n`);
}
