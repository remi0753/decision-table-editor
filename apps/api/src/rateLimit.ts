import type { SecondaryStorage } from './secondaryStorage.js';

export type FixedWindowRule = {
  key: string;
  max: number;
  windowSeconds: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; key: string; retryAfterSeconds: number };

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
): Promise<RateLimitResult> {
  for (const rule of rules) {
    const stored = parseCounter(await storage.get(rule.key));
    const resetAt = nowMs + rule.windowSeconds * 1000;
    const counter =
      stored && stored.resetAt > nowMs ? stored : { count: 0, resetAt };

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

    await storage.set(
      rule.key,
      JSON.stringify({ count: counter.count + 1, resetAt: counter.resetAt }),
      Math.ceil((counter.resetAt - nowMs) / 1000),
    );
  }

  return { allowed: true };
}
