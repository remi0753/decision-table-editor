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

export type SecondaryStorageConfig<Bindings extends Record<string, unknown>> =
  | SecondaryStorage
  | ((env: Bindings) => SecondaryStorage)
  | { type: 'memory' }
  | { type: 'redis'; client: RedisLikeClient }
  | { type: 'kv'; namespace: KvLikeNamespace }
  | {
      type: 'kv';
      binding: keyof Bindings & string;
      allowMemoryInLocalDev?: boolean;
    };

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
// isolates — production deployments must pass a KV namespace, Redis client,
// or custom SecondaryStorage through createLeverieServer({ secondaryStorage }).
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

// Selects the storage backend per-request. Local dev gets an in-memory fallback
// so the auth flow keeps working without provisioning external storage.
// Production must fail closed; falling back to isolate-local memory silently
// defeats auth and invitation rate limits.
export function resolveSecondaryStorage<
  Bindings extends Record<string, unknown>,
>(
  env: Bindings & { BETTER_AUTH_URL?: string },
  config?: SecondaryStorageConfig<Bindings>,
): SecondaryStorage {
  if (typeof config === 'function') return config(env);

  if (config && 'get' in config && 'set' in config && 'delete' in config) {
    return config;
  }

  if (config?.type === 'memory') return createMemorySecondaryStorage();
  if (config?.type === 'redis') {
    return createRedisSecondaryStorage(config.client);
  }
  if (config?.type === 'kv' && 'namespace' in config) {
    return createKvSecondaryStorage(config.namespace);
  }
  if (config?.type === 'kv' && 'binding' in config) {
    const namespace = env[config.binding];
    if (namespace) {
      return createKvSecondaryStorage(namespace as unknown as KvLikeNamespace);
    }
    if (!config.allowMemoryInLocalDev || !isLocalAuthUrl(env.BETTER_AUTH_URL)) {
      throw new Error(
        `KV binding "${config.binding}" is required for secondaryStorage.`,
      );
    }
    return createMemorySecondaryStorage();
  }

  if (!isLocalAuthUrl(env.BETTER_AUTH_URL)) {
    throw new Error(
      'secondaryStorage must be configured outside local development.',
    );
  }
  return createMemorySecondaryStorage();
}
