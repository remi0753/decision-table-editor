import { describe, expect, it } from 'vitest';
import type { ParsedCsv } from './csv.js';
import { buildReferenceTable } from './referenceTableBuild.js';

const parsed: ParsedCsv = {
  headers: ['order_id', 'purchase_date', 'tier'],
  rows: [
    { order_id: '123', purchase_date: '2026-05-28', tier: 'Gold' },
    { order_id: '456', purchase_date: '2026-05-29', tier: 'Silver' },
  ],
};
const activeFacts = new Set(['fDate', 'fTier']);
const activeFactCatalog = new Map([
  ['fDate', { id: 'fDate', type: 'date' as const, enumValues: null }],
  [
    'fTier',
    { id: 'fTier', type: 'enum' as const, enumValues: ['Gold', 'Silver'] },
  ],
]);

describe('buildReferenceTable', () => {
  it('builds columns, key columns, and hashed rows', async () => {
    const result = await buildReferenceTable(
      parsed,
      {
        keyColumns: ['order_id'],
        columnMappings: [
          { columnName: 'purchase_date', factId: 'fDate' },
          { columnName: 'tier', factId: 'fTier' },
        ],
      },
      activeFacts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rowCount).toBe(2);
    expect(result.value.keyColumns).toEqual(['order_id']);
    expect(result.value.columns).toContainEqual({
      name: 'purchase_date',
      factId: 'fDate',
      normalizer: undefined,
    });
    expect(result.value.rows[0]?.keyValues).toEqual({ order_id: '123' });
    expect(result.value.rows[0]?.keyHash).toBeTypeOf('string');
  });

  it('rejects duplicate keys', async () => {
    const dup: ParsedCsv = {
      headers: ['order_id'],
      rows: [{ order_id: '1' }, { order_id: '1' }],
    };
    const result = await buildReferenceTable(
      dup,
      { keyColumns: ['order_id'], columnMappings: [] },
      activeFacts,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('duplicate_key');
  });

  it('rejects unknown key columns and unmapped facts', async () => {
    const unknownKey = await buildReferenceTable(
      parsed,
      { keyColumns: ['missing'], columnMappings: [] },
      activeFacts,
    );
    expect(unknownKey.ok).toBe(false);
    if (!unknownKey.ok)
      expect(unknownKey.error.code).toBe('unknown_key_column');

    const unknownFact = await buildReferenceTable(
      parsed,
      {
        keyColumns: ['order_id'],
        columnMappings: [{ columnName: 'tier', factId: 'nope' }],
      },
      activeFacts,
    );
    expect(unknownFact.ok).toBe(false);
    if (!unknownFact.ok) expect(unknownFact.error.code).toBe('unknown_fact');
  });

  it('requires at least one key column', async () => {
    const result = await buildReferenceTable(
      parsed,
      { keyColumns: [], columnMappings: [] },
      activeFacts,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('key_columns_required');
  });

  it('rejects mapped values that cannot be converted to the fact type', async () => {
    const invalid: ParsedCsv = {
      headers: ['order_id', 'tier'],
      rows: [{ order_id: '123', tier: 'Platinum' }],
    };
    const result = await buildReferenceTable(
      invalid,
      {
        keyColumns: ['order_id'],
        columnMappings: [{ columnName: 'tier', factId: 'fTier' }],
      },
      activeFactCatalog,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_mapped_value');
  });
});
