import { describe, expect, it } from 'vitest';
import { checkFixedWindowRateLimit } from '../src/rateLimit.js';
import { createMemorySecondaryStorage } from '../src/secondaryStorage.js';

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
