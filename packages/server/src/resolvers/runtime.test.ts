import { describe, expect, it } from 'vitest';
import { computeKeyHash } from './referenceTable.js';
import {
  resolveFactsFromSnapshot,
  resolveReferenceTableRecipe,
  type SnapshotResolver,
  type SnapshotTable,
} from './runtime.js';
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

describe('resolveFactsFromSnapshot', () => {
  const factsById = new Map<string, FactView>([
    ['fDate', { id: 'fDate', type: 'date' }],
    ['fTier', { id: 'fTier', type: 'string' }],
  ]);
  const resolvers: SnapshotResolver[] = [
    {
      id: 'r1',
      status: 'active',
      dataSourceId: 's1',
      inputFactIds: ['fOrder'],
      parameterKeyMappings: [{ columnName: 'order_id', factId: 'fOrder' }],
      outputMappings: [
        { columnName: 'purchase_date', factId: 'fDate' },
        { columnName: 'tier', factId: 'fTier' },
      ],
    },
  ];
  const tables: SnapshotTable[] = [
    {
      dataSourceId: 's1',
      referenceTableId: 't1',
      version: 1,
      keyColumns: ['order_id'],
    },
  ];
  const bindings = [
    { fieldId: 'f_date', factId: 'fDate' },
    { fieldId: 'f_tier', factId: 'fTier' },
  ];

  it('resolves outputs and projects field ids when inputs are available', async () => {
    const result = await resolveFactsFromSnapshot({
      resolvers,
      tables,
      bindings,
      factsById,
      availableFacts: new Map([['fOrder', '123']]),
      fetchRowByHash: async () => ({
        purchase_date: '2026-05-28',
        tier: 'Gold',
      }),
      now: new Date('2026-06-14T00:00:00Z'),
    });
    expect(result.values).toHaveLength(2);
    const date = result.values.find((v) => v.factId === 'fDate');
    expect(date).toMatchObject({ fieldId: 'f_date', value: '2026-05-28' });
  });

  it('skips resolvers whose inputs are not yet available', async () => {
    const result = await resolveFactsFromSnapshot({
      resolvers,
      tables,
      bindings,
      factsById,
      availableFacts: new Map(),
      fetchRowByHash: async () => ({ purchase_date: '2026-05-28' }),
      now: new Date(),
    });
    expect(result.values).toEqual([]);
    expect(result.unavailable).toEqual([]);
  });

  it('marks outputs unavailable when no row matches', async () => {
    const result = await resolveFactsFromSnapshot({
      resolvers,
      tables,
      bindings,
      factsById,
      availableFacts: new Map([['fOrder', '999']]),
      fetchRowByHash: async () => null,
      now: new Date(),
    });
    expect(result.values).toEqual([]);
    expect(result.unavailable.map((u) => u.factId).sort()).toEqual([
      'fDate',
      'fTier',
    ]);
    expect(result.unavailable[0]?.reason).toBe('no_match');
  });
});
