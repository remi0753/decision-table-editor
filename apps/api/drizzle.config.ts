import type { Config } from 'drizzle-kit';

// drizzle-kit runs on Node (not Workers), so it connects directly to Postgres
// via node-postgres rather than through the Neon HTTP proxy. Local dev points
// at docker-compose Postgres; CI / preview / prod each pass their own
// DRIZZLE_DATABASE_URL pointing at the matching Neon branch.
//
// Schema source and generated migrations both live in @leverie/server
// (packages/server) so the published package can ship the migrations and
// self-hosters can run them via `leverie-server migrate`. apps/api just
// re-uses the same drizzle-kit setup against the workspace copy.
export default {
  schema: '../../packages/server/src/db/schema.ts',
  out: '../../packages/server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DRIZZLE_DATABASE_URL ??
      'postgres://dev:dev@localhost:5432/leverie_dev',
  },
  strict: true,
  verbose: true,
} satisfies Config;
