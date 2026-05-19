import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

// Phase 1's primary deployment surface is "Claude Desktop / Cursor / Cline
// spawn `npx leverie-mcp` and speak stdio." InMemoryTransport tests cover the
// MCP wiring but bypass the child-process boundary — they can't catch:
//   - stdout pollution (any stray `console.log` would corrupt the protocol)
//   - ESM/CJS resolution problems that only surface in a fresh Node process
//   - the CLI entrypoint failing to connect the transport at all
// One real-process E2E test puts that boundary under coverage.

const TSX_BIN = fileURLToPath(
  new URL('../node_modules/.bin/tsx', import.meta.url),
);
const CLI_ENTRY = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const FIXTURE = fileURLToPath(
  new URL('./fixtures/loan-review.json', import.meta.url),
);

describe('stdio E2E (real child process)', () => {
  it('serves tools/list and tools/call over stdio without polluting stdout', async () => {
    // `stderr: 'pipe'` lets us assert that the server's startup banner goes to
    // stderr (where it belongs); the SDK keeps stdout reserved for JSON-RPC
    // frames, so any leaked log on stdout would break protocol parsing here.
    const transport = new StdioClientTransport({
      command: TSX_BIN,
      args: [CLI_ENTRY, 'serve', FIXTURE],
      stderr: 'pipe',
    });

    const stderrChunks: Buffer[] = [];
    const client = new Client(
      { name: 'leverie-mcp-stdio-e2e', version: '0.0.0' },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);
      transport.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(['loan_review']);

      const result = await client.callTool({
        name: 'loan_review',
        arguments: { 'Customer Type': 'Corp', Amount: 1500000 },
      });
      expect(result.structuredContent).toMatchObject({
        status: 'ok',
        outputs: { Decision: 'Approve', Reason: 'Large corporate loan' },
      });
      // P1.5: trace returned alongside outputs, name-keyed (no internal IDs).
      const trace = (result.structuredContent as { trace: unknown[] }).trace;
      expect(Array.isArray(trace)).toBe(true);
      expect(trace).toHaveLength(1);
    } finally {
      await client.close();
    }

    // Startup banner is expected on stderr. If it ever migrates to stdout the
    // JSON-RPC handshake above would already have failed; this assertion makes
    // the contract explicit instead of relying on indirect failure modes.
    const stderrText = Buffer.concat(stderrChunks).toString('utf8');
    expect(stderrText).toContain('[leverie-mcp]');
  }, 20_000);
});
