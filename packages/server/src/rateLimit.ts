import type { SecondaryStorage } from './secondaryStorage.js';

export type FixedWindowRule = {
  key: string;
  max: number;
  windowSeconds: number;
};

export type RateLimitResult =
  | { allowed: true }
  // `key` identifies the exceeded rule for the SecondaryStorage limiter; other
  // backends (e.g. the Durable Object limiter) omit it, so it is optional.
  | { allowed: false; key?: string; retryAfterSeconds: number };

type Counter = {
  count: number;
  resetAt: number;
};

function parseCounter(value: string | null): Counter | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Counter>;
    if (
      typeof parsed.count === 'number' &&
      Number.isFinite(parsed.count) &&
      typeof parsed.resetAt === 'number' &&
      Number.isFinite(parsed.resetAt)
    ) {
      return { count: parsed.count, resetAt: parsed.resetAt };
    }
  } catch {
    // Ignore malformed counters and start a fresh window.
  }
  return null;
}

export async function checkFixedWindowRateLimit(
  storage: SecondaryStorage,
  rules: FixedWindowRule[],
  nowMs = Date.now(),
  // When provided, the counter increments are handed off instead of awaited.
  // Backends like Workers KV have slow writes (~hundreds of ms each); on the
  // hosted hot path the route passes a waitUntil-backed hook so the writes run
  // after the response. Omit it (the default) to await — callers needing an
  // accurate counter before returning, and the Node/test path, do this.
  deferWrite?: (work: Promise<unknown>) => void,
): Promise<RateLimitResult> {
  // Read every window concurrently — sequential reads were the dominant cost.
  const stored = await Promise.all(rules.map((rule) => storage.get(rule.key)));

  const updates: Array<{ key: string; value: string; ttl: number }> = [];
  for (const [i, rule] of rules.entries()) {
    const existing = parseCounter(stored[i] ?? null);
    const resetAt = nowMs + rule.windowSeconds * 1000;
    const counter =
      existing && existing.resetAt > nowMs ? existing : { count: 0, resetAt };

    if (counter.count >= rule.max) {
      return {
        allowed: false,
        key: rule.key,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((counter.resetAt - nowMs) / 1000),
        ),
      };
    }

    updates.push({
      key: rule.key,
      value: JSON.stringify({
        count: counter.count + 1,
        resetAt: counter.resetAt,
      }),
      ttl: Math.ceil((counter.resetAt - nowMs) / 1000),
    });
  }

  // Persist increments only once every window passed, so a denied request does
  // not burn a slot in the windows that were still under budget.
  const flush = Promise.all(
    updates.map((u) => storage.set(u.key, u.value, u.ttl)),
  );
  if (deferWrite) {
    deferWrite(flush);
  } else {
    await flush;
  }

  return { allowed: true };
}
