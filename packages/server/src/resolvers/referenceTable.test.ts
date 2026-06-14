import { describe, expect, it } from 'vitest';
import {
  buildLookupKeyHash,
  buildRowKeyHash,
  computeKeyHash,
  projectRow,
} from './referenceTable.js';
import type { FactView, OutputMapping } from './types.js';

describe('key hashing', () => {
  it('is stable and order-sensitive for composite keys', async () => {
    const ab = await computeKeyHash(['a', 'b']);
    const ab2 = await computeKeyHash(['a', 'b']);
    const ba = await computeKeyHash(['b', 'a']);
    expect(ab).toBe(ab2);
    expect(ab).not.toBe(ba);
  });

  it('does not collide single vs composite', async () => {
    const single = await computeKeyHash(['ab']);
    const composite = await computeKeyHash(['a', 'b']);
    expect(single).not.toBe(composite);
  });

  it('upload and lookup hashes match for the same normalized key', async () => {
    const rowHash = await buildRowKeyHash(['order_id'], { order_id: ' 123 ' });
    const lookup = await buildLookupKeyHash(['order_id'], { order_id: '123' });
    expect(lookup.ok).toBe(true);
    if (lookup.ok) expect(lookup.hash).toBe(rowHash);
  });

  it('reports missing key columns', async () => {
    const r = await buildLookupKeyHash(['a', 'b'], { a: '1', b: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(['b']);
  });
});

describe('projectRow', () => {
  const factsById = new Map<string, FactView>([
    ['fDate', { id: 'fDate', type: 'date' }],
    ['fTier', { id: 'fTier', type: 'enum', enumValues: ['Gold', 'Silver'] }],
  ]);
  const mappings: OutputMapping[] = [
    { columnName: 'purchase_date', factId: 'fDate' },
    { columnName: 'tier', factId: 'fTier' },
  ];

  it('projects normalized values with provenance', () => {
    const values = projectRow(
      { purchase_date: '2026/05/28', tier: 'gold' },
      mappings,
      factsById,
      { referenceTableId: 't1', referenceTableVersion: 1, retrievedAt: 'now' },
    );
    expect(values).toHaveLength(2);
    expect(values[0]).toMatchObject({
      factId: 'fDate',
      value: '2026-05-28',
      state: 'resolved',
      sourceKind: 'reference_table',
    });
    expect(values[0]?.provenance.sourceColumn).toBe('purchase_date');
    expect(values[1]).toMatchObject({ factId: 'fTier', value: 'Gold' });
  });

  it('marks invalid and unavailable cells', () => {
    const values = projectRow(
      { purchase_date: 'nope', tier: '' },
      mappings,
      factsById,
      { retrievedAt: 'now' },
    );
    expect(values[0]).toMatchObject({ factId: 'fDate', state: 'invalid' });
    expect(values[0]?.value).toBeUndefined();
    expect(values[1]).toMatchObject({ factId: 'fTier', state: 'unavailable' });
  });
});
