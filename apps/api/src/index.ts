import {
  createLeverieServer,
  type Env,
  runScheduledMaintenance,
} from '@leverie/server';

const app = createLeverieServer({
  editor: { enabled: false },
  secondaryStorage: {
    type: 'kv',
    binding: 'RATE_LIMIT_KV',
    allowMemoryInLocalDev: true,
  },
});

export type { Env };
export { app, createLeverieServer, runScheduledMaintenance };

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
