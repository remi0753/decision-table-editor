import { describe, expect, it } from 'vitest';
import { computeKeyHash } from './referenceTable.js';
import { resolveReferenceTableRecipe } from './runtime.js';
import type { FactView } from './types.js';

const factsById = new Map<string, FactView>([
  ['fDate', { id: 'fDate', type: 'date' }],
]);

function baseInput() {
  return {
    recipeId: 'r1',
    dataSourceId: 's1',
    referenceTableId: 't1',
    referenceTableVersion: 1,
    keyColumns: ['order_id'],
    parameterKeyMappings: [{ columnName: 'order_id', factId: 'fOrder' }],
    outputMappings: [{ columnName: 'purchase_date', factId: 'fDate' }],
    factsById,
    now: new Date('2026-06-14T00:00:00Z'),
  };
}

describe('resolveReferenceTableRecipe', () => {
  it('resolves facts from a matched row', async () => {
    const result = await resolveReferenceTableRecipe({
      ...baseInput(),
      availableFacts: new Map([['fOrder', '123']]),
      fetchRowByHash: async () => ({ purchase_date: '2026-05-28' }),
    });
    expect(result.matched).toBe(true);
    expect(result.values[0]).toMatchObject({
      factId: 'fDate',
      value: '2026-05-28',
      state: 'resolved',
    });
    expect(result.values[0]?.provenance.resolverRecipeId).toBe('r1');
  });

  it('reports missing keys when an input fact is absent', async () => {
    const result = await resolveReferenceTableRecipe({
      ...baseInput(),
      availableFacts: new Map(),
      fetchRowByHash: async () => ({ purchase_date: '2026-05-28' }),
    });
    expect(result.matched).toBe(false);
    expect(result.missingKeys).toEqual(['order_id']);
  });

  it('returns no match when the row is absent, hashing the supplied key', async () => {
    let askedHash = '';
    const result = await resolveReferenceTableRecipe({
      ...baseInput(),
      availableFacts: new Map([['fOrder', '999']]),
      fetchRowByHash: async (_t, hash) => {
        askedHash = hash;
        return null;
      },
    });
    expect(result.matched).toBe(false);
    expect(result.values).toEqual([]);
    expect(askedHash).toBe(await computeKeyHash(['999']));
  });
});
