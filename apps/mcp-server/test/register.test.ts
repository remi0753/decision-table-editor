import { copyFile, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/make-server.js';
import { loadAndRegisterPath } from '../src/register.js';

const FIXTURE = fileURLToPath(
  new URL('./fixtures/loan-review.json', import.meta.url),
);

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'leverie-reg-'));
}

async function writeLoanReview(dir: string, fileName: string): Promise<string> {
  const path = join(dir, fileName);
  await copyFile(FIXTURE, path);
  return path;
}

/** Re-write the fixture under a different logic name (and thus tool slug). */
async function writeRenamedLoanReview(
  dir: string,
  fileName: string,
  logicName: string,
): Promise<string> {
  const raw = await readFile(FIXTURE, 'utf8');
  const obj = JSON.parse(raw);
  obj.name = logicName;
  const path = join(dir, fileName);
  await writeFile(path, JSON.stringify(obj), 'utf8');
  return path;
}

describe('loadAndRegisterPath', () => {
  let logs: string[];
  let log: (m: string) => void;

  beforeEach(() => {
    logs = [];
    log = (m: string) => logs.push(m);
  });

  describe('single-file mode', () => {
    it('registers one tool from a Logic JSON file', async () => {
      const server = createServer();
      const result = await loadAndRegisterPath(server, FIXTURE, { log });
      expect(result.registered.size).toBe(1);
      expect(result.registered.has('loan_review')).toBe(true);
      expect(result.skipped).toEqual([]);
    });

    it('throws on a bad file regardless of --strict', async () => {
      const dir = await makeTempDir();
      const bad = join(dir, 'broken.json');
      await writeFile(bad, '{ not valid', 'utf8');

      await expect(
        loadAndRegisterPath(createServer(), bad, { log, strict: false }),
      ).rejects.toThrow(/Invalid JSON/);
      await expect(
        loadAndRegisterPath(createServer(), bad, { log, strict: true }),
      ).rejects.toThrow(/Invalid JSON/);
    });
  });

  describe('directory mode', () => {
    it('registers one tool per *.json file', async () => {
      const dir = await makeTempDir();
      await writeRenamedLoanReview(dir, 'a.json', 'Loan Review');
      await writeRenamedLoanReview(dir, 'b.json', 'Refund Decision');

      const server = createServer();
      const result = await loadAndRegisterPath(server, dir, { log });
      expect([...result.registered.keys()].sort()).toEqual([
        'loan_review',
        'refund_decision',
      ]);
      expect(result.skipped).toEqual([]);
    });

    it('skips invalid JSON in default mode and logs to stderr', async () => {
      const dir = await makeTempDir();
      await writeRenamedLoanReview(dir, 'good.json', 'Loan Review');
      const badPath = join(dir, 'bad.json');
      await writeFile(badPath, '{ not valid', 'utf8');

      const server = createServer();
      const result = await loadAndRegisterPath(server, dir, {
        log,
        strict: false,
      });
      expect([...result.registered.keys()]).toEqual(['loan_review']);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]!.filePath).toBe(badPath);
      expect(
        logs.some((m) => m.includes('skipping') && m.includes('bad.json')),
      ).toBe(true);
    });

    // register.test currently only proves that *unparseable JSON* is skipped.
    // The other failure mode — JSON that parses but doesn't match LogicSchema —
    // is handled by the same skip path in register.ts; pin it explicitly so a
    // refactor that swallows one branch but not the other can't sneak through.
    it('skips JSON files that violate LogicSchema in default mode and logs to stderr', async () => {
      const dir = await makeTempDir();
      await writeRenamedLoanReview(dir, 'good.json', 'Loan Review');
      const badPath = join(dir, 'not-a-logic.json');
      await writeFile(badPath, JSON.stringify({ hello: 'world' }), 'utf8');

      const server = createServer();
      const result = await loadAndRegisterPath(server, dir, {
        log,
        strict: false,
      });
      expect([...result.registered.keys()]).toEqual(['loan_review']);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]!.filePath).toBe(badPath);
      expect(
        logs.some(
          (m) => m.includes('skipping') && m.includes('not-a-logic.json'),
        ),
      ).toBe(true);
    });

    it('fails fast on a bad file under --strict', async () => {
      const dir = await makeTempDir();
      await writeRenamedLoanReview(dir, 'good.json', 'Loan Review');
      await writeFile(join(dir, 'bad.json'), '{ not valid', 'utf8');

      await expect(
        loadAndRegisterPath(createServer(), dir, { log, strict: true }),
      ).rejects.toThrow(/Invalid JSON/);
    });

    it('takes the first file on slug collision in default mode, warns about the rest', async () => {
      const dir = await makeTempDir();
      // Both produce slug "loan_review" because of identical names.
      // `a-` and `z-` prefixes pin the sort order so we know which wins.
      const first = await writeRenamedLoanReview(
        dir,
        'a-first.json',
        'Loan Review',
      );
      const second = await writeRenamedLoanReview(
        dir,
        'z-second.json',
        'loan review',
      );

      const server = createServer();
      const result = await loadAndRegisterPath(server, dir, {
        log,
        strict: false,
      });

      expect([...result.registered.keys()]).toEqual(['loan_review']);
      expect(result.registered.get('loan_review')!.filePath).toBe(first);
      expect(result.skipped).toEqual([
        expect.objectContaining({ filePath: second }),
      ]);
      expect(
        logs.some(
          (m) => m.includes('already used by') && m.includes('a-first.json'),
        ),
      ).toBe(true);
    });

    it('errors on slug collision under --strict', async () => {
      const dir = await makeTempDir();
      await writeRenamedLoanReview(dir, 'a.json', 'Loan Review');
      await writeRenamedLoanReview(dir, 'b.json', 'loan review');

      await expect(
        loadAndRegisterPath(createServer(), dir, { log, strict: true }),
      ).rejects.toThrow(/Duplicate tool slug/);
    });

    it('throws when the directory has no *.json files', async () => {
      const dir = await makeTempDir();
      await writeFile(join(dir, 'README.md'), '#', 'utf8');
      await expect(
        loadAndRegisterPath(createServer(), dir, { log }),
      ).rejects.toThrow(/no \*\.json files found/);
    });

    it('throws when every file fails to load (even without --strict)', async () => {
      const dir = await makeTempDir();
      await writeFile(join(dir, 'a.json'), '{ not valid', 'utf8');
      await writeFile(join(dir, 'b.json'), 'also not valid', 'utf8');
      await expect(
        loadAndRegisterPath(createServer(), dir, { log, strict: false }),
      ).rejects.toThrow(/every \*\.json under/);
    });
  });

  describe('end-to-end (in-memory MCP transport)', () => {
    it('serves every registered tool via tools/list and routes tools/call', async () => {
      const dir = await makeTempDir();
      await writeLoanReview(dir, 'loan-review.json');
      await writeRenamedLoanReview(dir, 'refund.json', 'Refund Decision');

      const server = createServer();
      await loadAndRegisterPath(server, dir, { log });

      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      const client = new Client(
        { name: 'leverie-mcp-test', version: '0.0.0' },
        { capabilities: {} },
      );
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      try {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name).sort();
        expect(names).toEqual(['loan_review', 'refund_decision']);

        const ok = await client.callTool({
          name: 'loan_review',
          arguments: { 'Customer Type': 'Corp', Amount: 1500000 },
        });
        expect(ok.structuredContent).toMatchObject({
          status: 'ok',
          outputs: { Decision: 'Approve', Reason: 'Large corporate loan' },
        });
      } finally {
        await client.close();
      }
    });
  });
});
