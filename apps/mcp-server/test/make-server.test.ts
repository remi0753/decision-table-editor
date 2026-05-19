import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { loadLogicFile } from '../src/load-logic.js';
import { makeLogicServer } from '../src/make-server.js';

const FIXTURE = fileURLToPath(
  new URL('./fixtures/loan-review.json', import.meta.url),
);
const ALL_TYPES_FIXTURE = fileURLToPath(
  new URL('./fixtures/all-types.json', import.meta.url),
);

async function connectFixture(fixturePath: string): Promise<Client> {
  const logic = await loadLogicFile(fixturePath);
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

async function connect(): Promise<Client> {
  return connectFixture(FIXTURE);
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

  // Per discussion_platform_vision.md §5, the natural-language descriptions on
  // the tool and on each input field are a Phase 1 differentiator — they're
  // what an LLM client reads to decide which tool to call and how to fill it
  // in. Treat them as part of the public contract, not free-form prose.
  it('exposes logic.description plus a generated Inputs/Outputs summary, and per-field descriptions', async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      const tool = tools[0]!;
      // Author prose comes first.
      expect(tool.description).toContain(
        'Decide whether to approve a loan based on customer type and amount.',
      );
      // Followed by the generated structural summary — what makes the tool
      // self-describing without the LLM having to inspect the schema.
      expect(tool.description).toContain('Inputs');
      expect(tool.description).toContain(
        'Customer Type (enum: Corp, Individual)',
      );
      expect(tool.description).toContain('Amount (number)');
      expect(tool.description).toContain('Outputs');
      expect(tool.description).toContain('- Decision');
      expect(tool.description).toContain('- Reason');

      const props = (
        tool.inputSchema as {
          properties: Record<string, { description?: string }>;
        }
      ).properties;
      expect(props['Customer Type']!.description).toBe('Field: Customer Type');
      expect(props.Amount!.description).toBe('Field: Amount');
      expect(props['Has Guarantor']!.description).toBe('Field: Has Guarantor');
    } finally {
      await client.close();
    }
  });

  // README §"What gets exposed" promises inputSchema generation for all six
  // field types. The base loan-review fixture only exercises enum/number/bool;
  // this test pins the wire-level schema for the remaining string/date/datetime
  // shapes so the helper in @leverie/schema can't silently regress.
  it('generates JSON Schema covering all six input field types (number/bool/enum/string/date/datetime)', async () => {
    const client = await connectFixture(ALL_TYPES_FIXTURE);
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(1);
      const tool = tools[0]!;
      expect(tool.name).toBe('all_types');

      const props = (
        tool.inputSchema as { properties: Record<string, unknown> }
      ).properties;

      expect(props.Count).toMatchObject({
        type: 'number',
        description: 'Field: Count',
      });
      expect(props.Active).toMatchObject({
        type: 'boolean',
        description: 'Field: Active',
      });
      expect(props.Tier).toMatchObject({
        type: 'string',
        enum: ['bronze', 'silver', 'gold'],
        description: 'Field: Tier',
      });
      expect(props.Note).toMatchObject({
        type: 'string',
        description: 'Field: Note',
      });
      expect(props['Joined On']).toMatchObject({
        type: 'string',
        description: expect.stringContaining('ISO 8601 date'),
      });
      expect(props['Last Seen At']).toMatchObject({
        type: 'string',
        description: expect.stringContaining('ISO 8601 datetime'),
      });
    } finally {
      await client.close();
    }
  });

  it('routes tools/call → evaluateLogicByName and returns ok structuredContent on a match, with a name-keyed trace', async () => {
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'loan_review',
        arguments: { 'Customer Type': 'Corp', Amount: 1500000 },
      });
      expect(result.structuredContent).toEqual({
        status: 'ok',
        outputs: { Decision: 'Approve', Reason: 'Large corporate loan' },
        trace: [
          {
            table: 'Review',
            depth: 0,
            matchedRow: { index: 1, conclusion: 'terminal' },
            skippedRows: [],
          },
        ],
      });
    } finally {
      await client.close();
    }
  });

  it('returns no_match structuredContent with the unmatched table name and a trace of every skipped row', async () => {
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'loan_review',
        arguments: { 'Customer Type': 'Corp', Amount: 500 },
      });
      // r1 fails on Amount (>= 1,000,000), r2 and r3 fail on Customer Type ("Individual"). No internal IDs leak.
      expect(result.structuredContent).toEqual({
        status: 'no_match',
        unmatchedTable: 'Review',
        trace: [
          {
            table: 'Review',
            depth: 0,
            matchedRow: null,
            skippedRows: [
              { index: 1, failedField: 'Amount' },
              { index: 2, failedField: 'Customer Type' },
              { index: 3, failedField: 'Customer Type' },
            ],
          },
        ],
      });
    } finally {
      await client.close();
    }
  });
});
