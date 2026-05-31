// Rate limiting abstraction. Call sites express *what* to limit
// (`limit(identityKey, rules)`); the backend decides *how*. This lets the
// hosted Worker plug in a Durable Object limiter (atomic, no per-key write
// caps, any window) while self-host / dev fall back to the configured
// SecondaryStorage (KV / Redis / memory) with the same fixed-window logic.
//
// Why an abstraction instead of using SecondaryStorage directly: Workers KV is
// the wrong store for hot per-request counters (slow writes, a hard 1-write/s
// per-key cap). The seam lets the hosted deployment inject an edge-native
// limiter without the server package depending on Cloudflare Durable Objects.

import {
  checkFixedWindowRateLimit,
  type RateLimitResult,
} from './rateLimit.js';
import {
  createMemorySecondaryStorage,
  type SecondaryStorage,
} from './secondaryStorage.js';

export type { RateLimitResult };

export type RateLimitRule = {
  max: number;
  windowSeconds: number;
};

export interface RateLimiter {
  // Check and consume every rule against a single identity `key`, atomically
  // where the backend allows. Returns the first exceeded rule (denied) or
  // `{ allowed: true }`. Rules for one `key` must use distinct windows.
  limit(key: string, rules: RateLimitRule[]): Promise<RateLimitResult>;
}

// Fixed-window limiter over a SecondaryStorage. Each rule gets its own counter
// key namespaced by window, so several windows can share one identity. This is
// the portable default (and the self-host path); the hosted Worker overrides it
// with a Durable Object limiter.
export function createSecondaryStorageRateLimiter(
  storage: SecondaryStorage,
): RateLimiter {
  return {
    limit(key, rules) {
      return checkFixedWindowRateLimit(
        storage,
        rules.map((rule) => ({
          key: `${key}:${rule.windowSeconds}`,
          max: rule.max,
          windowSeconds: rule.windowSeconds,
        })),
      );
    },
  };
}

// In-process limiter for local dev and unit tests. Not safe across isolates.
export function createMemoryRateLimiter(): RateLimiter {
  return createSecondaryStorageRateLimiter(createMemorySecondaryStorage());
}

export type RateLimiterConfig<Bindings extends Record<string, unknown>> =
  | RateLimiter
  // A factory may return undefined (e.g. the required binding is absent, as in
  // tests or a local run) to fall back to the SecondaryStorage-backed limiter.
  | ((env: Bindings) => RateLimiter | undefined);

// Picks the limiter for a request. An explicit `config` (a RateLimiter or a
// factory over the env bindings — e.g. the hosted Durable Object limiter) wins;
// otherwise fall back to a SecondaryStorage-backed limiter so deployments that
// only configure `secondaryStorage` keep working unchanged.
export function resolveRateLimiter<Bindings extends Record<string, unknown>>(
  env: Bindings,
  fallbackStorage: SecondaryStorage,
  config?: RateLimiterConfig<Bindings>,
): RateLimiter {
  if (typeof config === 'function') {
    const limiter = config(env);
    if (limiter) return limiter;
  } else if (config && typeof config === 'object' && 'limit' in config) {
    return config;
  }
  return createSecondaryStorageRateLimiter(fallbackStorage);
}
