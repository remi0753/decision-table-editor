import type { Logic } from '@leverie/engine';
import { describe, expect, it } from 'vitest';
import {
  logicNameToToolSlug,
  logicToInputSchema,
  logicToMcpTool,
  logicToOutputSchema,
} from './index';

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
