// Shared key-value abstraction used by Better Auth for rate-limit counters
// (and any future ephemeral lookup that needs to survive across Worker
// isolates). The shape mirrors Better Auth's `secondaryStorage` contract so
// the same instance can be plugged in via `betterAuth({ secondaryStorage })`,
// while staying tiny enough to back with ioredis on a Node deployment.

export interface SecondaryStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// Minimal Workers KV surface we depend on. Typed locally so this file does
// not pull `@cloudflare/workers-types` into non-Worker consumers.
export interface KvLikeNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

// Cloudflare Workers KV requires `expirationTtl >= 60`. Rate-limit windows
// are usually shorter; we floor at 60 so KV accepts the write. The longer
// TTL only delays cleanup — the rate-limiter computes its window from the
// stored timestamp, so a stale-but-not-yet-expired row is read correctly.
const KV_MIN_TTL_SECONDS = 60;

export function createKvSecondaryStorage(
  kv: KvLikeNamespace,
): SecondaryStorage {
  return {
    async get(key) {
      return (await kv.get(key)) ?? null;
    },
    async set(key, value, ttl) {
      const expirationTtl =
        ttl !== undefined ? Math.max(ttl, KV_MIN_TTL_SECONDS) : undefined;
      await kv.put(
        key,
        value,
        expirationTtl !== undefined ? { expirationTtl } : undefined,
      );
    },
    async delete(key) {
      await kv.delete(key);
    },
  };
}

// ioredis-compatible surface. Lets a Node-side deployment drop in an
// `import Redis from 'ioredis'; createRedisSecondaryStorage(new Redis(url))`
// without depending on ioredis from this Workers bundle.
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode?: 'EX',
    ttl?: number,
  ): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export function createRedisSecondaryStorage(
  client: RedisLikeClient,
): SecondaryStorage {
  return {
    async get(key) {
      return (await client.get(key)) ?? null;
    },
    async set(key, value, ttl) {
      if (ttl !== undefined) {
        await client.set(key, value, 'EX', ttl);
      } else {
        await client.set(key, value);
      }
    },
    async delete(key) {
      await client.del(key);
    },
  };
}

// In-process fallback for local dev / unit tests. Not safe across Worker
// isolates — production deployments must wire `RATE_LIMIT_KV` (or a Redis
// client) in instead.
export function createMemorySecondaryStorage(): SecondaryStorage {
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttl) {
      store.set(key, {
        value,
        expiresAt: ttl !== undefined ? Date.now() + ttl * 1000 : null,
      });
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function isLocalAuthUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

// Selects the storage backend per-request. Workers bind `RATE_LIMIT_KV` to a
// KV namespace in production / preview. Local dev (wrangler dev) gets an
// in-memory fallback so the auth flow keeps working without provisioning KV.
// Production must fail closed; falling back to isolate-local memory silently
// defeats auth and invitation rate limits on Cloudflare Workers.
export function resolveSecondaryStorage(env: {
  BETTER_AUTH_URL?: string;
  RATE_LIMIT_KV?: KvLikeNamespace;
}): SecondaryStorage {
  if (env.RATE_LIMIT_KV) return createKvSecondaryStorage(env.RATE_LIMIT_KV);
  if (!isLocalAuthUrl(env.BETTER_AUTH_URL)) {
    throw new Error('RATE_LIMIT_KV binding is required outside local dev.');
  }
  return createMemorySecondaryStorage();
}
