import { type FSWatcher, watch as fsWatch } from 'node:fs';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  applyRegistration,
  type LoadAndRegisterOptions,
  prepareRegistration,
  type RegisteredEntry,
} from './register.js';

/**
 * Coalesce rapid-fire fs events into a single reload. Editors and OS
 * file APIs often emit multiple events per save (rename + change, separate
 * inotify wakeups, etc.); without debouncing we'd reload several times per
 * write and race the registry rebuild against itself.
 */
const RELOAD_DEBOUNCE_MS = 150;

export interface Watcher {
  /** Stop watching. Idempotent. */
  stop(): void;
}

export interface StartWatcherOptions {
  server: McpServer;
  path: string;
  kind: 'file' | 'directory';
  registry: Map<string, RegisteredEntry>;
  registerOpts: LoadAndRegisterOptions;
  log: (message: string) => void;
}

/**
 * Watch the source path and rebuild the tool registry on change.
 *
 * Strategy: full teardown + re-register. Tool sets in P1.3 are small (a
 * handful per directory) so the simpler rebuild beats diffing the file list
 * against the live registry. `RegisteredTool.remove()` and `registerTool()`
 * each emit `tools/list_changed`, so a connected client sees one notify per
 * tool turnover, which the SDK debounces internally enough for our cadence.
 *
 * Watch errors are non-fatal: if a reload throws, we log it and keep the
 * previous tool set alive. This matches the "skip-and-warn" spirit of
 * default mode and avoids killing the server when one save breaks a file.
 */
export async function startWatcher(
  options: StartWatcherOptions,
): Promise<Watcher> {
  const { server, path, kind, registerOpts, log } = options;
  // Mutable shared state: the active registry. Reassigned on each reload.
  let registry = options.registry;
  let reloadTimer: NodeJS.Timeout | undefined;
  let reloadInFlight = false;
  let reloadQueued = false;
  let stopped = false;

  const absolute = resolve(path);

  const triggerReload = (): void => {
    if (stopped) return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTimer = undefined;
      void runReload();
    }, RELOAD_DEBOUNCE_MS);
  };

  const runReload = async (): Promise<void> => {
    if (reloadInFlight) {
      reloadQueued = true;
      return;
    }
    reloadInFlight = true;
    try {
      log(`[leverie-mcp] change detected in ${path}; reloading…`);
      // Validate the new file set BEFORE touching the live registry.
      // If preparation throws (bad file, empty directory, slug collision
      // under --strict), the previous tool set keeps serving.
      const prepared = await prepareRegistration(path, registerOpts);

      for (const entry of registry.values()) entry.handle.remove();
      registry.clear();
      registry = applyRegistration(server, prepared).registered;

      log(
        `[leverie-mcp] reload complete: ${registry.size} tool${registry.size === 1 ? '' : 's'} active`,
      );
    } catch (err) {
      log(
        `[leverie-mcp] reload failed (${(err as Error).message}); previous tool set remains active until next change`,
      );
    } finally {
      reloadInFlight = false;
      if (reloadQueued) {
        reloadQueued = false;
        triggerReload();
      }
    }
  };

  const watcher = createFsWatcher(absolute, kind, triggerReload, log);

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      if (reloadTimer) clearTimeout(reloadTimer);
      watcher.close();
    },
  };
}

function createFsWatcher(
  absolute: string,
  kind: 'file' | 'directory',
  onChange: () => void,
  log: (message: string) => void,
): FSWatcher {
  // `recursive: false` on a directory watch is the cross-platform safe path
  // (recursive is unsupported on Linux). Single-file mode watches the file
  // itself; on rename-then-write editor flows this still fires because the
  // path stays the inode's name.
  const watcher = fsWatch(
    absolute,
    { persistent: false, recursive: false },
    (eventType, filename) => {
      if (kind === 'directory') {
        // `filename` may be null on some platforms; in that case we have
        // to reload because we don't know what changed.
        if (filename && !filename.toLowerCase().endsWith('.json')) return;
      }
      void eventType; // unused — any event triggers a debounced reload
      onChange();
    },
  );

  watcher.on('error', (err) => {
    log(`[leverie-mcp] watcher error: ${err.message}`);
  });

  return watcher;
}
