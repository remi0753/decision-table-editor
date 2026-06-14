import { describe, expect, it } from 'vitest';
import { buildDataSnapshot, stableStringify } from './snapshot.js';

describe('stableStringify', () => {
  it('sorts object keys recursively', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });
});

describe('buildDataSnapshot', () => {
  const input = {
    bindings: [
      { fieldId: 'f2', factId: 'fact2' },
      { fieldId: 'f1', factId: 'fact1' },
    ],
    factDefinitions: [{ id: 'fact2' }, { id: 'fact1' }],
    resolverRecipes: [{ id: 'r1' }],
    dataSources: [{ id: 's1' }],
    referenceTables: [
      { dataSourceId: 's1', referenceTableId: 't1', version: 3 },
    ],
  };

  it('produces a stable hash regardless of input ordering', async () => {
    const a = await buildDataSnapshot(input);
    const b = await buildDataSnapshot({
      ...input,
      bindings: [...input.bindings].reverse(),
      factDefinitions: [...input.factDefinitions].reverse(),
    });
    expect(a.snapshotHash).toBe(b.snapshotHash);
    expect(a.bindings[0]?.fieldId).toBe('f1');
  });

  it('changes the hash when a pinned reference table version changes', async () => {
    const a = await buildDataSnapshot(input);
    const b = await buildDataSnapshot({
      ...input,
      referenceTables: [
        { dataSourceId: 's1', referenceTableId: 't1', version: 4 },
      ],
    });
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
  });
});
