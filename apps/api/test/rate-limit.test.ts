import { describe, expect, it } from 'vitest';
import { checkFixedWindowRateLimit } from '../../../packages/server/src/rateLimit.js';
import {
  createMemorySecondaryStorage,
  type KvLikeNamespace,
  type RedisLikeClient,
  resolveSecondaryStorage,
} from '../../../packages/server/src/secondaryStorage.js';

describe('fixed-window rate limit', () => {
  it('allows requests until the configured limit and then returns retry metadata', async () => {
    const storage = createMemorySecondaryStorage();
    const rules = [{ key: 'invite:test', max: 2, windowSeconds: 60 }];
    const now = Date.parse('2026-05-24T00:00:00.000Z');

    await expect(
      checkFixedWindowRateLimit(storage, rules, now),
    ).resolves.toEqual({ allowed: true });
    await expect(
      checkFixedWindowRateLimit(storage, rules, now + 1000),
    ).resolves.toEqual({ allowed: true });
    await expect(
      checkFixedWindowRateLimit(storage, rules, now + 2000),
    ).resolves.toEqual({
      allowed: false,
      key: 'invite:test',
      retryAfterSeconds: 58,
    });
  });
});

describe('secondary storage configuration', () => {
  it('accepts an explicit Redis-compatible client', async () => {
    const values = new Map<string, string>();
    const redis: RedisLikeClient = {
      get: async (key) => values.get(key) ?? null,
      set: async (key, value) => {
        values.set(key, value);
      },
      del: async (key) => {
        values.delete(key);
      },
    };

    const storage = resolveSecondaryStorage(
      { BETTER_AUTH_URL: 'https://leverie.dev' },
      { type: 'redis', client: redis },
    );

    await storage.set('k', 'v', 10);
    await expect(storage.get('k')).resolves.toBe('v');
  });

  it('accepts an explicit Workers KV binding name instead of defaulting', async () => {
    const values = new Map<string, string>();
    const kv: KvLikeNamespace = {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => {
        values.set(key, value);
      },
      delete: async (key) => {
        values.delete(key);
      },
    };

    const storage = resolveSecondaryStorage(
      { BETTER_AUTH_URL: 'https://leverie.dev', RATE_LIMIT_KV: kv },
      { type: 'kv', binding: 'RATE_LIMIT_KV' },
    );

    await storage.set('k', 'v', 10);
    await expect(storage.get('k')).resolves.toBe('v');
  });

  it('fails closed when no explicit storage is configured outside local dev', () => {
    expect(() =>
      resolveSecondaryStorage({ BETTER_AUTH_URL: 'https://leverie.dev' }),
    ).toThrow('secondaryStorage must be configured');
  });
});
