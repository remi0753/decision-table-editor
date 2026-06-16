import { describe, expect, it } from 'vitest';
import type { DriverContext } from '../resolvers/driver.js';
import type { FactView } from '../resolvers/types.js';
import {
  assertReadOnlyQuery,
  buildPositionalQuery,
  databaseDriver,
} from './database.js';

describe('assertReadOnlyQuery', () => {
  it('accepts a single SELECT', () => {
    expect(() =>
      assertReadOnlyQuery('SELECT a FROM t WHERE id = :id'),
    ).not.toThrow();
  });
  it('accepts a WITH query and a trailing semicolon', () => {
    expect(() =>
      assertReadOnlyQuery('WITH x AS (SELECT 1) SELECT * FROM x;'),
    ).not.toThrow();
  });
  it('rejects multiple statements', () => {
    expect(() => assertReadOnlyQuery('SELECT 1; DROP TABLE t')).toThrow();
  });
  it('rejects non-select statements', () => {
    expect(() => assertReadOnlyQuery('UPDATE t SET a = 1')).toThrow();
    expect(() => assertReadOnlyQuery('DELETE FROM t')).toThrow();
  });
});

describe('buildPositionalQuery', () => {
  it('rewrites named placeholders to positional and dedupes repeats', () => {
    const { sql, params } = buildPositionalQuery(
      'SELECT * FROM o WHERE id = :id OR alt = :id AND tier = :tier',
      { id: '12345', tier: 'Gold' },
    );
    expect(sql).toBe('SELECT * FROM o WHERE id = $1 OR alt = $1 AND tier = $2');
    expect(params).toEqual(['12345', 'Gold']);
  });
  it('throws on an unbound placeholder', () => {
    expect(() => buildPositionalQuery('SELECT :missing', {})).toThrow();
  });
});

const factsById = new Map<string, FactView>([
  ['fDate', { id: 'fDate', type: 'date' }],
]);

function ctx(overrides: Partial<DriverContext> = {}): DriverContext {
  return {
    resolverId: 'r1',
    operation: {
      kind: 'db_query',
      query: 'SELECT purchase_date FROM orders WHERE order_id = :order_id',
      params: [{ name: 'order_id', factId: 'fOrder' }],
    },
    source: { id: 's1', kind: 'database', config: {}, secretRef: null },
    outputMappings: [{ columnName: 'purchase_date', factId: 'fDate' }],
    availableFacts: new Map([['fOrder', '12345']]),
    factsById,
    now: new Date('2026-06-17T00:00:00Z'),
    deps: {},
    ...overrides,
  };
}

describe('databaseDriver', () => {
  it('reports missing keys when an input fact is absent', async () => {
    const result = await databaseDriver.resolve(
      ctx({
        availableFacts: new Map(),
        deps: { queryExecutor: { queryOne: async () => null } },
      }),
    );
    expect(result.matched).toBe(false);
    expect(result.missingKeys).toEqual(['order_id']);
  });

  it('projects a returned row into fact values with database provenance', async () => {
    const result = await databaseDriver.resolve(
      ctx({
        deps: {
          queryExecutor: {
            queryOne: async ({ sql, params }) => {
              expect(sql).toContain('$1');
              expect(params).toEqual(['12345']);
              return { purchase_date: '2026-05-28' };
            },
          },
        },
      }),
    );
    expect(result.matched).toBe(true);
    expect(result.values[0]).toMatchObject({
      factId: 'fDate',
      value: '2026-05-28',
      state: 'resolved',
      sourceKind: 'api',
    });
    expect(result.values[0]?.provenance.sourceKindLabel).toBe('database');
  });

  it('returns no match when the row is absent', async () => {
    const result = await databaseDriver.resolve(
      ctx({ deps: { queryExecutor: { queryOne: async () => null } } }),
    );
    expect(result.matched).toBe(false);
    expect(result.values).toEqual([]);
  });

  it('does not match when no executor is wired (edge runtime)', async () => {
    const result = await databaseDriver.resolve(ctx({ deps: {} }));
    expect(result.matched).toBe(false);
  });
});
