import type { Dirent, Stats } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Inspect a path and report whether it points at a file or a directory.
 *
 * Used by `serve()` to dispatch single-file vs directory mode. Throws if
 * the path does not exist or cannot be stat'd.
 */
export type PathKind = 'file' | 'directory';

export async function classifyPath(path: string): Promise<PathKind> {
  const absolute = resolve(path);
  let info: Stats;
  try {
    info = await stat(absolute);
  } catch (err) {
    throw new Error(`Failed to stat ${absolute}: ${(err as Error).message}`);
  }
  if (info.isDirectory()) return 'directory';
  if (info.isFile()) return 'file';
  throw new Error(
    `Path is neither a regular file nor a directory: ${absolute}`,
  );
}

/**
 * List `*.json` files directly inside `dir` (non-recursive), sorted by name
 * for deterministic load order.
 *
 * P1.3 intentionally stays flat: nested directories are not descended into.
 * Recursive scanning can come later when workspace / org concepts arrive in
 * P3 — until then, "directory of logic files" is the predictable contract.
 */
export async function listLogicJsonFiles(dir: string): Promise<string[]> {
  const absolute = resolve(dir);
  let entries: Dirent[];
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `Failed to read directory ${absolute}: ${(err as Error).message}`,
    );
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.json')) continue;
    files.push(join(absolute, entry.name));
  }
  files.sort();
  return files;
}
