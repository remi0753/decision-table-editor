import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/make-server.js';
import { loadAndRegisterPath } from '../src/register.js';
import { classifyPath } from '../src/scan-directory.js';
import { startWatcher, type Watcher } from '../src/watch.js';

const FIXTURE = fileURLToPath(
  new URL('./fixtures/loan-review.json', import.meta.url),
);

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'leverie-watch-'));
}

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

async function connectClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: 'leverie-mcp-watch-test', version: '0.0.0' },
    { capabilities: {} },
  );
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

let activeWatcher: Watcher | undefined;
let activeClient: Client | undefined;

afterEach(async () => {
  activeWatcher?.stop();
  activeWatcher = undefined;
  if (activeClient) {
    await activeClient.close();
    activeClient = undefined;
  }
});

// fs.watch is eventually-consistent: editor saves + macOS FSEvents + the
// 150ms debounce in watch.ts can stack up. 8s is generous enough for CI
// noise but still bounded so a real bug surfaces quickly.
const WAIT_TIMEOUT = 8000;

describe('startWatcher', () => {
  it('re-registers tools when a new *.json file is added to the directory', async () => {
    const dir = await makeTempDir();
    await writeRenamedLoanReview(dir, 'loan.json', 'Loan Review');

    const server = createServer();
    const initial = await loadAndRegisterPath(server, dir, {});
    expect([...initial.registered.keys()]).toEqual(['loan_review']);

    const client = await connectClient(server);
    activeClient = client;

    activeWatcher = await startWatcher({
      server,
      path: dir,
      kind: 'directory',
      registry: initial.registered,
      registerOpts: {},
      log: () => {},
    });

    await writeRenamedLoanReview(dir, 'refund.json', 'Refund Decision');

    await vi.waitFor(
      async () => {
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name).sort()).toEqual([
          'loan_review',
          'refund_decision',
        ]);
      },
      { timeout: WAIT_TIMEOUT, interval: 100 },
    );
  });

  it('drops the tool for a file deleted from the watched directory', async () => {
    const dir = await makeTempDir();
    await writeRenamedLoanReview(dir, 'loan.json', 'Loan Review');
    const refundPath = await writeRenamedLoanReview(
      dir,
      'refund.json',
      'Refund Decision',
    );

    const server = createServer();
    const initial = await loadAndRegisterPath(server, dir, {});
    const client = await connectClient(server);
    activeClient = client;

    activeWatcher = await startWatcher({
      server,
      path: dir,
      kind: 'directory',
      registry: initial.registered,
      registerOpts: {},
      log: () => {},
    });

    await rm(refundPath);

    await vi.waitFor(
      async () => {
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toEqual(['loan_review']);
      },
      { timeout: WAIT_TIMEOUT, interval: 100 },
    );
  });

  it('keeps the previous tool set when a reload fails (non-fatal reload errors)', async () => {
    // Start healthy, then corrupt the only file. Reload should fail; the
    // tool registered before the corruption should remain available.
    const dir = await makeTempDir();
    const filePath = await writeRenamedLoanReview(
      dir,
      'loan.json',
      'Loan Review',
    );

    const server = createServer();
    const initial = await loadAndRegisterPath(server, dir, {});
    const client = await connectClient(server);
    activeClient = client;

    const logs: string[] = [];
    activeWatcher = await startWatcher({
      server,
      path: dir,
      kind: 'directory',
      registry: initial.registered,
      registerOpts: { strict: false },
      log: (m) => logs.push(m),
    });

    // Corrupt the JSON. With one file in the directory and that file now
    // broken, loadAndRegisterPath would throw ("every *.json failed");
    // the watcher catches it and keeps the previous registry.
    await writeFile(filePath, '{ broken', 'utf8');

    await vi.waitFor(
      () => {
        expect(logs.some((m) => m.includes('reload failed'))).toBe(true);
      },
      { timeout: WAIT_TIMEOUT, interval: 100 },
    );

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['loan_review']);
  });

  it('reloads when the single watched file is edited', async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, 'logic.json');
    await copyFile(FIXTURE, filePath);

    const server = createServer();
    const initial = await loadAndRegisterPath(server, filePath, {});
    const client = await connectClient(server);
    activeClient = client;

    const kind = await classifyPath(filePath);
    activeWatcher = await startWatcher({
      server,
      path: filePath,
      kind,
      registry: initial.registered,
      registerOpts: {},
      log: () => {},
    });

    // Rename the logic in place; the slug should change after reload.
    await writeRenamedLoanReview(dir, 'logic.json', 'Refund Decision');

    await vi.waitFor(
      async () => {
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toEqual(['refund_decision']);
      },
      { timeout: WAIT_TIMEOUT, interval: 100 },
    );
  });
});
