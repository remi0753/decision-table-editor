import type { Logic } from '@leverie/engine';
import { evaluateTable } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  evaluateLogicByName,
  formatTrace,
  logicNameToToolSlug,
  logicToInputSchema,
  logicToMcpTool,
  logicToOutputSchema,
  logicToToolDescription,
  logicToZodInputShape,
  logicToZodOutputShape,
} from './index.js';

function makeLogic(): Logic {
  return {
    version: '2',
    name: 'Loan Review',
    description:
      'Decide whether to approve a loan based on customer type and amount.',
    entryTableId: 't1',
    fieldDefs: {
      f1: {
        id: 'f1',
        name: 'Customer Type',
        type: 'enum',
        enumValues: ['Corp', 'Individual'],
      },
      f2: { id: 'f2', name: 'Amount', type: 'number' },
      f3: { id: 'f3', name: 'Has Guarantor', type: 'bool' },
      f4: { id: 'f4', name: 'Application Date', type: 'date' },
    },
    tables: {
      t1: {
        id: 't1',
        name: 'Initial Review',
        cols: [],
        outputCols: [
          { id: 'oc1', name: 'Decision' },
          { id: 'oc2', name: 'Reason' },
        ],
        rows: [],
      },
      t2: {
        id: 't2',
        name: 'Secondary Review',
        cols: [],
        outputCols: [
          { id: 'oc3', name: 'Decision' },
          { id: 'oc4', name: 'Reviewer' },
        ],
        rows: [],
      },
    },
    nField: 5,
    nTable: 3,
    nCol: 1,
    nOCol: 5,
    nRow: 1,
  };
}

describe('logicToInputSchema', () => {
  it('maps each field type to the expected JSON Schema type', () => {
    const schema = logicToInputSchema(makeLogic());
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties?.['Customer Type']).toMatchObject({
      type: 'string',
      enum: ['Corp', 'Individual'],
    });
    expect(schema.properties?.Amount).toMatchObject({ type: 'number' });
    expect(schema.properties?.['Has Guarantor']).toMatchObject({
      type: 'boolean',
    });
    expect(schema.properties?.['Application Date']).toMatchObject({
      type: 'string',
      format: 'date',
    });
  });

  it('uses field names (not IDs) as property keys', () => {
    const schema = logicToInputSchema(makeLogic());
    expect(Object.keys(schema.properties ?? {})).toEqual(
      expect.arrayContaining([
        'Customer Type',
        'Amount',
        'Has Guarantor',
        'Application Date',
      ]),
    );
    expect(schema.properties?.f1).toBeUndefined();
  });

  it('uses the logic description in the title/description', () => {
    const schema = logicToInputSchema(makeLogic());
    expect(schema.title).toContain('Loan Review');
    expect(schema.description).toContain('approve a loan');
  });
});

describe('logicToOutputSchema', () => {
  it('returns a oneOf schema with ok and no_match branches', () => {
    const schema = logicToOutputSchema(makeLogic());
    expect(schema.oneOf).toHaveLength(2);
  });

  it('unions output column names across all tables', () => {
    const schema = logicToOutputSchema(makeLogic());
    const okBranch = schema.oneOf?.[0];
    const outputs = okBranch?.properties?.outputs;
    const names = Object.keys(outputs?.properties ?? {});
    // Decision appears in both tables — deduplicated.
    expect(new Set(names)).toEqual(new Set(['Decision', 'Reason', 'Reviewer']));
  });
});

describe('logicNameToToolSlug', () => {
  it('converts spaces and punctuation to underscores', () => {
    expect(logicNameToToolSlug('Loan Review')).toBe('loan_review');
    expect(logicNameToToolSlug('  Trim & Squeeze!! ')).toBe('trim_squeeze');
  });

  it('falls back to "logic" for empty/non-alphanumeric names', () => {
    expect(logicNameToToolSlug('')).toBe('logic');
    expect(logicNameToToolSlug('!!!')).toBe('logic');
  });

  it('splits camelCase / PascalCase / acronym boundaries', () => {
    expect(logicNameToToolSlug('loanReview')).toBe('loan_review');
    expect(logicNameToToolSlug('LoanReview')).toBe('loan_review');
    // Acronym followed by a word: HTTP + Server → http_server.
    expect(logicNameToToolSlug('HTTPServer')).toBe('http_server');
    expect(logicNameToToolSlug('parseJSONResponse')).toBe(
      'parse_json_response',
    );
  });

  it('prefixes with "tool_" when the result would start with a digit', () => {
    // MCP clients commonly reject tool names whose first char is not a letter.
    expect(logicNameToToolSlug('123Logic')).toBe('tool_123_logic');
    expect(logicNameToToolSlug('2024 Review')).toBe('tool_2024_review');
  });

  it('caps overly long names at 64 chars', () => {
    const long = 'a'.repeat(200);
    const slug = logicNameToToolSlug(long);
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug).toBe('a'.repeat(64));
  });
});

describe('logicToToolDescription', () => {
  it('keeps the author description and appends Inputs/Outputs sections', () => {
    const desc = logicToToolDescription(makeLogic());
    expect(desc.startsWith('Decide whether to approve a loan')).toBe(true);
    // Field section
    expect(desc).toContain('Inputs');
    expect(desc).toContain('Customer Type (enum: Corp, Individual)');
    expect(desc).toContain('Amount (number)');
    expect(desc).toContain('Has Guarantor (bool)');
    expect(desc).toContain('Application Date (ISO 8601 date)');
    // Outputs section — union of all tables.
    expect(desc).toContain('Outputs');
    expect(desc).toContain('- Decision');
    expect(desc).toContain('- Reason');
    expect(desc).toContain('- Reviewer');
  });

  it('falls back to a generated description when logic.description is missing', () => {
    const logic = makeLogic();
    logic.description = undefined;
    const desc = logicToToolDescription(logic);
    expect(desc).toContain('Loan Review');
    expect(desc).toContain('Inputs');
  });
});

describe('logicToMcpTool', () => {
  it('produces a complete MCP tool definition', () => {
    const tool = logicToMcpTool(makeLogic());
    expect(tool.name).toBe('loan_review');
    expect(tool.description).toContain('approve a loan');
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.outputSchema.oneOf).toHaveLength(2);
  });
});

describe('logicToZodInputShape', () => {
  it('maps each field type to the expected Zod schema and makes every field optional', () => {
    const shape = logicToZodInputShape(makeLogic());
    expect(Object.keys(shape)).toEqual(
      expect.arrayContaining([
        'Customer Type',
        'Amount',
        'Has Guarantor',
        'Application Date',
      ]),
    );

    // All fields optional → undefined parses successfully on every key.
    const wrapped = z.object(shape);
    expect(wrapped.parse({}).Amount).toBeUndefined();

    // Numbers reject strings; the JSON-Schema variant tolerates strings via
    // engine coercion, but the Zod path is strict — that's the SDK contract.
    expect(() => wrapped.parse({ Amount: 'not-a-number' })).toThrow();
    expect(wrapped.parse({ Amount: 1500000 }).Amount).toBe(1500000);

    // Enum constrained to the declared values.
    expect(wrapped.parse({ 'Customer Type': 'Corp' })['Customer Type']).toBe(
      'Corp',
    );
    expect(() => wrapped.parse({ 'Customer Type': 'Other' })).toThrow();
  });
});

describe('logicToZodOutputShape', () => {
  it('returns a single object schema with status + outputs + unmatchedTable + trace, dedup-unioning output column names', () => {
    const shape = logicToZodOutputShape(makeLogic());
    expect(Object.keys(shape).sort()).toEqual([
      'outputs',
      'status',
      'trace',
      'unmatchedTable',
    ]);

    const wrapped = z.object(shape);
    const ok = wrapped.parse({
      status: 'ok',
      outputs: { Decision: 'Approve', Reason: 'looks good', Reviewer: 'alice' },
      trace: [
        {
          table: 'Initial Review',
          depth: 0,
          matchedRow: { index: 1, conclusion: 'terminal' },
          skippedRows: [],
        },
      ],
    });
    expect(ok.status).toBe('ok');

    const noMatch = wrapped.parse({
      status: 'no_match',
      unmatchedTable: 'Initial Review',
      trace: [
        {
          table: 'Initial Review',
          depth: 0,
          matchedRow: null,
          skippedRows: [{ index: 1, failedField: 'Customer Type' }],
        },
      ],
    });
    expect(noMatch.unmatchedTable).toBe('Initial Review');

    // status is the only required field.
    expect(() => wrapped.parse({})).toThrow();
    expect(() => wrapped.parse({ status: 'invalid' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Round-trip: schema → evaluation → schema
// ---------------------------------------------------------------------------
//
// Regression guard for bug_001: the JSON Schemas advertised by this package
// are field-name keyed, but the engine's native contract is fieldId keyed.
// These tests assert that the full advertised round-trip actually closes —
// an LLM-shaped call against the input schema lands on a matching row and
// produces outputs that match the output schema's shape.

function makeRunnableLogic(): Logic {
  return {
    version: '2',
    name: 'Loan Review',
    description: 'Decide whether to approve a loan.',
    entryTableId: 't1',
    fieldDefs: {
      f1: {
        id: 'f1',
        name: 'Customer Type',
        type: 'enum',
        enumValues: ['Corp', 'Individual'],
      },
      f2: { id: 'f2', name: 'Amount', type: 'number' },
    },
    tables: {
      t1: {
        id: 't1',
        name: 'Review',
        cols: [
          { id: 'c1', fieldId: 'f1' },
          { id: 'c2', fieldId: 'f2' },
        ],
        outputCols: [
          { id: 'oc1', name: 'Decision' },
          { id: 'oc2', name: 'Reason' },
        ],
        rows: [
          {
            id: 'r1',
            cells: {
              c1: { op: '=', val: 'Corp' },
              c2: { op: '>=', val: '1000000' },
            },
            conclusion: {
              type: 'terminal',
              outputs: { oc1: 'Approve', oc2: 'Large corporate loan' },
            },
          },
          {
            id: 'r2',
            cells: { c1: { op: '=', val: 'Individual' } },
            conclusion: {
              type: 'terminal',
              outputs: { oc1: 'Reject', oc2: 'Individual not eligible' },
            },
          },
        ],
      },
    },
    nField: 2,
    nTable: 1,
    nCol: 2,
    nOCol: 2,
    nRow: 2,
  };
}

describe('Schema ↔ engine round-trip', () => {
  it('evaluateTable accepts name-keyed inputs (the shape logicToInputSchema advertises)', () => {
    const logic = makeRunnableLogic();
    const schema = logicToInputSchema(logic);
    // The LLM is told to send this shape:
    const llmInput = { 'Customer Type': 'Corp', Amount: '1500000' };
    // Sanity-check the schema actually advertises those exact keys.
    for (const key of Object.keys(llmInput)) {
      expect(schema.properties).toHaveProperty(key);
    }
    const result = evaluateTable(logic.entryTableId, llmInput, logic);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // Engine's native contract returns id-keyed outputs.
      expect(result.outputs).toEqual({
        oc1: 'Approve',
        oc2: 'Large corporate loan',
      });
    }
  });

  it('evaluateTable still accepts id-keyed inputs (existing editor contract)', () => {
    const logic = makeRunnableLogic();
    const result = evaluateTable(
      logic.entryTableId,
      { f1: 'Corp', f2: '1500000' },
      logic,
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.outputs).toEqual({
        oc1: 'Approve',
        oc2: 'Large corporate loan',
      });
    }
  });

  it('evaluateLogicByName closes the round-trip with name-keyed inputs AND outputs', () => {
    const logic = makeRunnableLogic();
    const inputSchema = logicToInputSchema(logic);
    const outputSchema = logicToOutputSchema(logic);

    const result = evaluateLogicByName(logic, {
      'Customer Type': 'Corp',
      Amount: '1500000',
    });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // Outputs are keyed by name, matching the output schema.
      expect(result.outputs).toEqual({
        Decision: 'Approve',
        Reason: 'Large corporate loan',
      });

      // Cross-check: every advertised output key appears in the schema.
      const okBranch = outputSchema.oneOf?.[0];
      const advertisedOutputs = okBranch?.properties?.outputs?.properties ?? {};
      for (const key of Object.keys(result.outputs)) {
        expect(advertisedOutputs).toHaveProperty(key);
      }
    }

    // And input keys all come from the advertised input schema.
    for (const key of ['Customer Type', 'Amount']) {
      expect(inputSchema.properties).toHaveProperty(key);
    }
  });

  it('evaluateLogicByName returns no_match cleanly when no row matches', () => {
    const logic = makeRunnableLogic();
    const result = evaluateLogicByName(logic, {
      'Customer Type': 'Corp',
      Amount: '500', // too small — r1 requires >= 1,000,000
    });
    expect(result.status).toBe('no_match');
    if (result.status === 'no_match') {
      expect(result.tableId).toBe('t1');
    }
  });
});

describe('formatTrace', () => {
  it('replaces internal IDs with table names, 1-based row indices, and field names', () => {
    const logic = makeRunnableLogic();
    // Individual customer → r2 matches immediately (r1 is skipped on Customer Type).
    const result = evaluateLogicByName(logic, {
      'Customer Type': 'Individual',
    });
    const formatted = formatTrace(logic, result.trace);
    expect(formatted).toHaveLength(1);
    const step = formatted[0]!;
    expect(step.table).toBe('Review');
    expect(step.depth).toBe(0);
    expect(step.matchedRow).toEqual({ index: 2, conclusion: 'terminal' });
    // r1 was skipped on the Customer Type cell ("Corp" != "Individual").
    expect(step.skippedRows).toEqual([
      { index: 1, failedField: 'Customer Type' },
    ]);
  });

  it('returns matchedRow=null and lists every skipped row on no_match', () => {
    const logic = makeRunnableLogic();
    // Customer Type missing entirely → both r1 and r2 fail on the same column.
    const result = evaluateLogicByName(logic, { Amount: '2000000' });
    expect(result.status).toBe('no_match');
    const formatted = formatTrace(logic, result.trace);
    expect(formatted).toHaveLength(1);
    expect(formatted[0]!.matchedRow).toBeNull();
    expect(formatted[0]!.skippedRows).toEqual([
      { index: 1, failedField: 'Customer Type' },
      { index: 2, failedField: 'Customer Type' },
    ]);
  });

  it('marks continue conclusions with nextTable', () => {
    const logic: Logic = {
      version: '2',
      name: 'Chained',
      description: 'Two-table chain.',
      entryTableId: 't1',
      fieldDefs: {
        f1: {
          id: 'f1',
          name: 'Tier',
          type: 'enum',
          enumValues: ['gold', 'silver'],
        },
      },
      tables: {
        t1: {
          id: 't1',
          name: 'Triage',
          cols: [{ id: 'c1', fieldId: 'f1' }],
          outputCols: [],
          rows: [
            {
              id: 'r1',
              cells: { c1: { op: '=', val: 'gold' } },
              conclusion: { type: 'continue', tableId: 't2' },
            },
          ],
        },
        t2: {
          id: 't2',
          name: 'Premium Path',
          cols: [],
          outputCols: [{ id: 'oc1', name: 'Verdict' }],
          rows: [
            {
              id: 'r1',
              cells: {},
              conclusion: { type: 'terminal', outputs: { oc1: 'approve' } },
            },
          ],
        },
      },
      nField: 1,
      nTable: 2,
      nCol: 1,
      nOCol: 1,
      nRow: 2,
    };
    const result = evaluateLogicByName(logic, { Tier: 'gold' });
    const formatted = formatTrace(logic, result.trace);
    expect(formatted).toHaveLength(2);
    expect(formatted[0]!.matchedRow).toEqual({
      index: 1,
      conclusion: 'continue',
      nextTable: 'Premium Path',
    });
    expect(formatted[1]!.table).toBe('Premium Path');
    expect(formatted[1]!.matchedRow).toEqual({
      index: 1,
      conclusion: 'terminal',
    });
  });
});
