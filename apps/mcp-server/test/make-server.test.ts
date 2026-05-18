import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { loadLogicFile } from '../src/load-logic.js';
import { makeLogicServer } from '../src/make-server.js';

const FIXTURE = fileURLToPath(
  new URL('./fixtures/loan-review.json', import.meta.url),
);

async function connect(): Promise<Client> {
  const logic = await loadLogicFile(FIXTURE);
  const server = makeLogicServer(logic);
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
  return client;
}

describe('makeLogicServer', () => {
  it('advertises the logic as one MCP tool with derived input/output JSON Schema', async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(1);
      const tool = tools[0]!;
      expect(tool.name).toBe('loan_review');
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          'Customer Type': { type: 'string', enum: ['Corp', 'Individual'] },
          Amount: { type: 'number' },
          'Has Guarantor': { type: 'boolean' },
        },
      });
      expect(tool.outputSchema).toMatchObject({
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'no_match'] },
        },
        required: ['status'],
      });
    } finally {
      await client.close();
    }
  });

  it('routes tools/call → evaluateLogicByName and returns ok structuredContent on a match', async () => {
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'loan_review',
        arguments: { 'Customer Type': 'Corp', Amount: 1500000 },
      });
      expect(result.structuredContent).toEqual({
        status: 'ok',
        outputs: { Decision: 'Approve', Reason: 'Large corporate loan' },
      });
    } finally {
      await client.close();
    }
  });

  it('returns no_match structuredContent when no row matches', async () => {
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'loan_review',
        arguments: { 'Customer Type': 'Corp', Amount: 500 },
      });
      expect(result.structuredContent).toEqual({
        status: 'no_match',
        tableId: 't1',
      });
    } finally {
      await client.close();
    }
  });
});
