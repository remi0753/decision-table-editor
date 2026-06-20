import { describe, expect, it } from 'vitest';
import type { DriverContext } from '../resolvers/driver.js';
import type { FactView } from '../resolvers/types.js';
import {
  buildAuthHeaders,
  buildRequestUrl,
  extractRecord,
  httpDriver,
  isDomainAllowed,
} from './http.js';

describe('buildRequestUrl', () => {
  it('fills and url-encodes placeholders', () => {
    expect(
      buildRequestUrl('https://api.shop.test/orders/{orderId}', {
        orderId: 'a b/c',
      }),
    ).toBe('https://api.shop.test/orders/a%20b%2Fc');
  });
  it('throws on an unbound placeholder', () => {
    expect(() => buildRequestUrl('https://x/{a}', {})).toThrow();
  });
});

describe('isDomainAllowed', () => {
  it('allows exact and subdomain matches, denies others and empty lists', () => {
    expect(isDomainAllowed('https://api.shop.test/x', ['shop.test'])).toBe(
      true,
    );
    expect(isDomainAllowed('https://shop.test/x', ['shop.test'])).toBe(true);
    expect(isDomainAllowed('https://evil.test/x', ['shop.test'])).toBe(false);
    expect(isDomainAllowed('https://shop.test/x', [])).toBe(false);
  });
});

describe('buildAuthHeaders', () => {
  it('builds bearer / api key / basic headers', () => {
    expect(
      buildAuthHeaders({ authType: 'bearer', value: { token: 't' } }),
    ).toEqual({
      Authorization: 'Bearer t',
    });
    expect(
      buildAuthHeaders({
        authType: 'api_key',
        value: { key: 'k', header: 'X-Key' },
      }),
    ).toEqual({ 'X-Key': 'k' });
    expect(buildAuthHeaders(null)).toEqual({});
  });
  it('builds a basic header from username/password', () => {
    expect(
      buildAuthHeaders({
        authType: 'basic',
        value: { username: 'alice', password: 'hunter2' },
      }),
    ).toEqual({ Authorization: `Basic ${btoa('alice:hunter2')}` });
  });
});

describe('extractRecord', () => {
  it('follows a dotted record path and unwraps arrays', () => {
    expect(extractRecord({ data: { order: { id: 1 } } }, 'data.order')).toEqual(
      { id: 1 },
    );
    expect(extractRecord({ items: [{ id: 1 }, { id: 2 }] }, 'items')).toEqual({
      id: 1,
    });
    expect(extractRecord(null)).toBeNull();
  });
});

const factsById = new Map<string, FactView>([
  ['fDate', { id: 'fDate', type: 'date' }],
]);

function ctx(overrides: Partial<DriverContext> = {}): DriverContext {
  return {
    resolverId: 'r1',
    operation: {
      kind: 'http_operation',
      method: 'GET',
      urlTemplate: 'https://api.shop.test/orders/{orderId}',
      params: [{ name: 'orderId', factId: 'fOrder' }],
      recordPath: 'order',
    },
    source: {
      id: 's1',
      kind: 'openapi_http',
      config: { allowedDomains: ['shop.test'] },
      secretRef: null,
    },
    outputMappings: [{ columnName: 'created_at', factId: 'fDate' }],
    availableFacts: new Map([['fOrder', '12345']]),
    factsById,
    now: new Date('2026-06-17T00:00:00Z'),
    deps: {},
    ...overrides,
  };
}

describe('httpDriver', () => {
  it('fetches, extracts the record, and projects facts with http provenance', async () => {
    const fetchFn = (async (url: string) => {
      expect(url).toBe('https://api.shop.test/orders/12345');
      return new Response(
        JSON.stringify({ order: { created_at: '2026-05-28' } }),
        {
          status: 200,
        },
      );
    }) as unknown as typeof fetch;
    const result = await httpDriver.resolve(ctx({ deps: { fetchFn } }));
    expect(result.matched).toBe(true);
    expect(result.values[0]).toMatchObject({
      factId: 'fDate',
      value: '2026-05-28',
    });
    expect(result.values[0]?.provenance.sourceKindLabel).toBe('http');
  });

  it('throws when the URL is not in the allow-list', async () => {
    await expect(
      httpDriver.resolve(
        ctx({
          source: {
            id: 's1',
            kind: 'openapi_http',
            config: { allowedDomains: ['other.test'] },
            secretRef: null,
          },
          deps: {
            fetchFn: (async () =>
              new Response('{}')) as unknown as typeof fetch,
          },
        }),
      ),
    ).rejects.toThrow(/allow-list/);
  });

  it('treats a 404 as no match', async () => {
    const fetchFn = (async () =>
      new Response('not found', { status: 404 })) as unknown as typeof fetch;
    const result = await httpDriver.resolve(ctx({ deps: { fetchFn } }));
    expect(result.matched).toBe(false);
  });

  it('reports missing keys when the parameter fact is absent', async () => {
    const result = await httpDriver.resolve(ctx({ availableFacts: new Map() }));
    expect(result.matched).toBe(false);
    expect(result.missingKeys).toEqual(['orderId']);
  });
});
