import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadLogicFile } from '../src/load-logic.js';

const FIXTURE = fileURLToPath(
  new URL('./fixtures/loan-review.json', import.meta.url),
);

describe('loadLogicFile', () => {
  it('loads and validates a well-formed Logic JSON file', async () => {
    const logic = await loadLogicFile(FIXTURE);
    expect(logic.name).toBe('Loan Review');
    expect(logic.entryTableId).toBe('t1');
    expect(Object.keys(logic.fieldDefs)).toHaveLength(3);
  });

  it('throws a helpful error when the file does not exist', async () => {
    await expect(
      loadLogicFile('/nonexistent/path/should/not/exist.json'),
    ).rejects.toThrow(/Failed to read/);
  });

  it('throws a helpful error when the file contains invalid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leverie-mcp-'));
    const path = join(dir, 'bad.json');
    await writeFile(path, '{ not: valid json', 'utf8');
    await expect(loadLogicFile(path)).rejects.toThrow(/Invalid JSON/);
  });

  it('throws a helpful error when the JSON does not match LogicSchema', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leverie-mcp-'));
    const path = join(dir, 'wrong-shape.json');
    await writeFile(path, JSON.stringify({ hello: 'world' }), 'utf8');
    await expect(loadLogicFile(path)).rejects.toThrow(
      /Logic validation failed/,
    );
  });
});
