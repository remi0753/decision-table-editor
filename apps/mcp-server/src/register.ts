import type { Logic } from '@leverie/engine';
import { logicNameToToolSlug } from '@leverie/schema';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadLogicFile } from './load-logic.js';
import { registerLogicTool } from './make-server.js';
import { classifyPath, listLogicJsonFiles } from './scan-directory.js';

/** Resolved logic ready to be registered. Produced by `prepareRegistration`. */
export interface PreparedLogic {
  filePath: string;
  logic: Logic;
  slug: string;
}

export interface PreparedRegistration {
  toRegister: PreparedLogic[];
  /** Files that were intentionally skipped in non-strict mode. */
  skipped: Array<{ filePath: string; reason: string }>;
}

/**
 * One slot in the live registry. We keep enough metadata to rebuild the
 * registry on `--watch` reloads without re-stating the source path.
 */
export interface RegisteredEntry {
  slug: string;
  filePath: string;
  logicName: string;
  /** Returned by `McpServer.registerTool`; call `.remove()` on reload. */
  handle: { remove: () => void };
}

export interface RegistrationLog {
  /** Slug → entry, in registration order. */
  registered: Map<string, RegisteredEntry>;
  /** Files that were intentionally skipped in non-strict mode. */
  skipped: Array<{ filePath: string; reason: string }>;
}

export interface LoadAndRegisterOptions {
  /**
   * Fail fast on the first unreadable/invalid file or slug collision.
   * Off by default — bad files are logged to stderr and skipped so the
   * rest of the directory still serves.
   */
  strict?: boolean;
  /**
   * Stderr-shaped logger. Defaults to no-op so tests stay quiet.
   * `serve()` wires it to `process.stderr.write`.
   */
  log?: (message: string) => void;
}

/**
 * Phase 1 of the load: read + validate every Logic file under `path` and
 * decide which slugs would be registered, without touching the server.
 *
 * Splitting validation from registration lets `--watch` confirm a reload
 * would succeed before tearing down the live tool set. See
 * `apply Registration` for phase 2.
 *
 * Strict semantics:
 * - file mode: always throws on a bad file. An empty server cannot answer
 *   `tools/list` (the SDK wires that handler lazily on the first
 *   `registerTool` call), so there is nothing meaningful to "skip" to.
 * - directory mode: in `--strict`, the first bad file or slug collision
 *   throws. In default mode, the offender is logged and the rest continue.
 *   An empty result is still an error.
 */
export async function prepareRegistration(
  path: string,
  options: LoadAndRegisterOptions = {},
): Promise<PreparedRegistration> {
  const strict = options.strict ?? false;
  const log = options.log ?? (() => {});

  const kind = await classifyPath(path);

  if (kind === 'file') {
    const logic = await loadLogicFile(path);
    return {
      toRegister: [
        { filePath: path, logic, slug: logicNameToToolSlug(logic.name) },
      ],
      skipped: [],
    };
  }

  const files = await listLogicJsonFiles(path);
  const toRegister: PreparedLogic[] = [];
  const seenSlugs = new Map<string, PreparedLogic>();
  const skipped: PreparedRegistration['skipped'] = [];

  for (const filePath of files) {
    let logic: Logic;
    try {
      logic = await loadLogicFile(filePath);
    } catch (err) {
      const reason = (err as Error).message;
      if (strict) throw err;
      log(`[leverie-mcp] skipping ${filePath}: ${reason}`);
      skipped.push({ filePath, reason });
      continue;
    }

    const slug = logicNameToToolSlug(logic.name);
    const existing = seenSlugs.get(slug);
    if (existing) {
      const reason = `tool slug "${slug}" already used by ${existing.filePath} (logic name: "${existing.logic.name}")`;
      if (strict) {
        throw new Error(`Duplicate tool slug for ${filePath}: ${reason}`);
      }
      log(`[leverie-mcp] skipping ${filePath}: ${reason}`);
      skipped.push({ filePath, reason });
      continue;
    }

    const prepared: PreparedLogic = { filePath, logic, slug };
    toRegister.push(prepared);
    seenSlugs.set(slug, prepared);
  }

  if (toRegister.length === 0) {
    const detail =
      files.length === 0
        ? `no *.json files found in ${path}`
        : `every *.json under ${path} failed to load (${skipped.length} file${skipped.length === 1 ? '' : 's'})`;
    throw new Error(
      `${detail}. An MCP server with zero tools cannot answer tools/list; aborting.`,
    );
  }

  return { toRegister, skipped };
}

/**
 * Phase 2: register every prepared logic onto the server. Returns the live
 * registry so callers can tear it down on the next `--watch` reload.
 */
export function applyRegistration(
  server: McpServer,
  prepared: PreparedRegistration,
): RegistrationLog {
  const registered = new Map<string, RegisteredEntry>();
  for (const item of prepared.toRegister) {
    const handle = registerLogicTool(server, item.logic);
    registered.set(item.slug, {
      slug: item.slug,
      filePath: item.filePath,
      logicName: item.logic.name,
      handle,
    });
  }
  return { registered, skipped: prepared.skipped };
}

/**
 * Convenience wrapper: prepare + apply in one shot. Used by `serve()` for
 * the initial load; `--watch` uses the two phases separately so a failed
 * reload can leave the previous tool set in place.
 */
export async function loadAndRegisterPath(
  server: McpServer,
  path: string,
  options: LoadAndRegisterOptions = {},
): Promise<RegistrationLog> {
  const prepared = await prepareRegistration(path, options);
  return applyRegistration(server, prepared);
}
