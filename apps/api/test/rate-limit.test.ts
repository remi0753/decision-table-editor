import { describe, expect, it } from 'vitest';
import { checkFixedWindowRateLimit } from '../../../packages/server/src/rateLimit.js';
import {
  createMemoryRateLimiter,
  resolveRateLimiter,
} from '../../../packages/server/src/rateLimiter.js';
import {
  createMemorySecondaryStorage,
  deferStorageWrites,
  type KvLikeNamespace,
  type RedisLikeClient,
  resolveSecondaryStorage,
  type SecondaryStorage,
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

describe('RateLimiter', () => {
  it('enforces a window per identity and reports retryAfter on denial', async () => {
    const limiter = createMemoryRateLimiter();
    const rules = [{ max: 2, windowSeconds: 60 }];

    expect(await limiter.limit('evaluate:k1', rules)).toEqual({
      allowed: true,
    });
    expect(await limiter.limit('evaluate:k1', rules)).toEqual({
      allowed: true,
    });
    const denied = await limiter.limit('evaluate:k1', rules);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    }
    // A different identity has its own budget.
    expect(await limiter.limit('evaluate:k2', rules)).toEqual({
      allowed: true,
    });
  });

  it('falls back to the secondary-storage limiter when the factory yields undefined', async () => {
    const limiter = resolveRateLimiter(
      {},
      createMemorySecondaryStorage(),
      () => undefined,
    );
    expect(await limiter.limit('k', [{ max: 1, windowSeconds: 60 }])).toEqual({
      allowed: true,
    });
    const denied = await limiter.limit('k', [{ max: 1, windowSeconds: 60 }]);
    expect(denied.allowed).toBe(false);
  });
});

describe('deferStorageWrites', () => {
  it('awaits immediate keys but hands the rest to deferWrite without awaiting', async () => {
    // A base whose set() only resolves when we say so, to observe await vs defer.
    const pending: Array<{ key: string; resolve: () => void }> = [];
    const base: SecondaryStorage = {
      get: async () => null,
      set: (key) =>
        new Promise<void>((resolve) => {
          pending.push({ key, resolve });
        }),
      delete: async () => {},
    };
    const deferred: Promise<unknown>[] = [];
    const storage = deferStorageWrites(base, {
      // Mirrors the auth wiring: Better Auth rate-limit keys are `${ip}|${path}`.
      awaitImmediately: (key) => key.includes('|'),
      deferWrite: (work) => {
        deferred.push(work);
      },
    });

    // Immediate (rate-limit) key: set() must not resolve until base.set does.
    let immediateDone = false;
    const immediate = storage
      .set('1.2.3.4|/sign-in/email', 'rl', 60)
      .then(() => {
        immediateDone = true;
      });
    await Promise.resolve();
    expect(immediateDone).toBe(false);
    expect(deferred).toHaveLength(0);
    pending.find((p) => p.key === '1.2.3.4|/sign-in/email')?.resolve();
    await immediate;
    expect(immediateDone).toBe(true);

    // Deferred (session) key: set() resolves now; the write is queued instead.
    await storage.set('active-sessions-u1', 'sess', 60);
    expect(deferred).toHaveLength(1);
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
