import {
  createLeverieServer,
  type Env,
  runScheduledMaintenance,
} from '@leverie/server';
import {
  createDurableObjectRateLimiter,
  RateLimiterDurableObject,
} from './rateLimiterDurableObject.js';

// Env plus the Durable Object namespace bound in wrangler.toml (preview/prod).
type ApiEnv = Env & { RATE_LIMITER?: DurableObjectNamespace };

const app = createLeverieServer({
  editor: { enabled: false },
  secondaryStorage: {
    type: 'kv',
    binding: 'RATE_LIMIT_KV',
    allowMemoryInLocalDev: true,
  },
  // Use the Durable Object limiter when its binding is present (deployed
  // Workers); otherwise return undefined so the server falls back to the
  // SecondaryStorage limiter (local dev / tests, which have no DO binding).
  rateLimiter: (env) => {
    const namespace = (env as ApiEnv).RATE_LIMITER;
    return namespace ? createDurableObjectRateLimiter(namespace) : undefined;
  },
});

export type { Env };
export {
  app,
  createLeverieServer,
  RateLimiterDurableObject,
  runScheduledMaintenance,
};

export default {
  fetch: app.fetch.bind(app),
  scheduled: async (
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(runScheduledMaintenance(env));
  },
};
