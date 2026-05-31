import type {
  RateLimiter,
  RateLimitResult,
  RateLimitRule,
} from '@leverie/server';

type StoredCounter = { count: number; resetAt: number };

// Durable Object fixed-window rate limiter. One instance per identity key
// (idFromName(key)) owns that key's counters — one per window — in its own
// transactional storage. Increments are atomic (single-threaded per instance)
// and free of Workers KV's per-key write-rate cap, and any window size works
// (10s, 60s, 600s, daily). Written in the classic constructor style so this
// module pulls in no `cloudflare:workers` runtime import — the class can be
// loaded (for re-export) in plain Node test runs without the Workers runtime.
export class RateLimiterDurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const rules = (await request.json()) as RateLimitRule[];
    const now = Date.now();

    // Serialize the read-decide-write so concurrent calls to the same key
    // cannot race the counter.
    const result = await this.state.blockConcurrencyWhile<RateLimitResult>(
      async () => {
        const stored = await Promise.all(
          rules.map((rule) =>
            this.state.storage.get<StoredCounter>(`w:${rule.windowSeconds}`),
          ),
        );

        const updates: Array<[string, StoredCounter]> = [];
        for (const [i, rule] of rules.entries()) {
          const existing = stored[i];
          const resetAt = now + rule.windowSeconds * 1000;
          const counter =
            existing && existing.resetAt > now
              ? existing
              : { count: 0, resetAt };
          if (counter.count >= rule.max) {
            return {
              allowed: false,
              retryAfterSeconds: Math.max(
                1,
                Math.ceil((counter.resetAt - now) / 1000),
              ),
            };
          }
          updates.push([
            `w:${rule.windowSeconds}`,
            { count: counter.count + 1, resetAt: counter.resetAt },
          ]);
        }

        for (const [key, value] of updates) {
          await this.state.storage.put(key, value);
        }
        // Drop the counters once the longest window elapses so idle keys do not
        // retain storage; fresh traffic pushes the alarm forward.
        const maxResetAt = Math.max(
          ...updates.map(([, value]) => value.resetAt),
        );
        await this.state.storage.setAlarm(maxResetAt);
        return { allowed: true };
      },
    );

    return Response.json(result);
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}

// Adapter: routes each identity key to its own DO instance. One round trip per
// limit() call regardless of how many windows the rule set carries.
export function createDurableObjectRateLimiter(
  namespace: DurableObjectNamespace,
): RateLimiter {
  return {
    async limit(key, rules) {
      const stub = namespace.get(namespace.idFromName(key));
      const res = await stub.fetch('https://rate-limiter.internal/limit', {
        method: 'POST',
        body: JSON.stringify(rules),
      });
      return (await res.json()) as RateLimitResult;
    },
  };
}
