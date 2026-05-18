import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyPath, listLogicJsonFiles } from '../src/scan-directory.js';

const FIXTURE_FILE = fileURLToPath(
  new URL('./fixtures/loan-review.json', import.meta.url),
);
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

describe('classifyPath', () => {
  it("returns 'file' for a regular file", async () => {
    expect(await classifyPath(FIXTURE_FILE)).toBe('file');
  });

  it("returns 'directory' for a directory", async () => {
    expect(await classifyPath(FIXTURE_DIR)).toBe('directory');
  });

  it('throws with a helpful message for a missing path', async () => {
    await expect(classifyPath('/nonexistent/should/not/exist')).rejects.toThrow(
      /Failed to stat/,
    );
  });
});

describe('listLogicJsonFiles', () => {
  it('returns only direct *.json children, sorted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leverie-scan-'));
    await writeFile(join(dir, 'b.json'), '{}', 'utf8');
    await writeFile(join(dir, 'a.json'), '{}', 'utf8');
    await writeFile(join(dir, 'README.md'), '#', 'utf8');
    await writeFile(join(dir, 'notes.txt'), 'x', 'utf8');

    const files = await listLogicJsonFiles(dir);
    expect(files).toEqual([join(dir, 'a.json'), join(dir, 'b.json')]);
  });

  it('returns an empty list when the directory has no *.json files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leverie-scan-'));
    await writeFile(join(dir, 'README.md'), '#', 'utf8');
    expect(await listLogicJsonFiles(dir)).toEqual([]);
  });

  it('matches the .json suffix case-insensitively', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leverie-scan-'));
    await writeFile(join(dir, 'Upper.JSON'), '{}', 'utf8');
    const files = await listLogicJsonFiles(dir);
    expect(files).toEqual([join(dir, 'Upper.JSON')]);
  });

  // README §"Directory mode" promises directory scans are non-recursive. If
  // someone refactors to a recursive `readdir`, the user contract changes
  // silently — pin the behavior with a positive test (top-level json is found)
  // alongside a negative one (nested json is not).
  it('does not descend into subdirectories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leverie-scan-'));
    await writeFile(join(dir, 'top.json'), '{}', 'utf8');
    const nested = join(dir, 'nested');
    await mkdir(nested);
    await writeFile(join(nested, 'deep.json'), '{}', 'utf8');

    const files = await listLogicJsonFiles(dir);
    expect(files).toEqual([join(dir, 'top.json')]);
  });
});
