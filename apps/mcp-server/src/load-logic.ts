import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type Logic, LogicSchema } from '@leverie/engine';

/**
 * Read and validate a Logic JSON file from disk.
 *
 * Rejects with a single Error whose message names the file and the failing
 * step (read / JSON parse / schema validation). `serve()` decides whether
 * to skip-and-warn or fail-fast based on `--strict`.
 */
export async function loadLogicFile(path: string): Promise<Logic> {
  const absolutePath = resolve(path);

  let raw: string;
  try {
    raw = await readFile(absolutePath, 'utf8');
  } catch (err) {
    throw new Error(
      `Failed to read ${absolutePath}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${absolutePath}: ${(err as Error).message}`,
    );
  }

  const result = LogicSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    const more =
      result.error.issues.length > 5
        ? `\n  ...and ${result.error.issues.length - 5} more`
        : '';
    throw new Error(
      `Logic validation failed for ${absolutePath}:\n${issues}${more}`,
    );
  }

  // LogicSchema's inferred type is intentionally looser than `Logic`
  // (e.g. `op` is z.string() rather than the Operator union). The runtime
  // guarantees still hold, so a single cast at the boundary is the right
  // pattern until P3's Logic JSON spec freeze tightens the schema types.
  return result.data as Logic;
}
