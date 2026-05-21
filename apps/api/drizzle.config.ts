import type { Config } from 'drizzle-kit';

// drizzle-kit runs on Node (not Workers), so it connects directly to Postgres
// via node-postgres rather than through the Neon HTTP proxy. Local dev points
// at docker-compose Postgres; CI / preview / prod each pass their own
// DRIZZLE_DATABASE_URL pointing at the matching Neon branch.
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DRIZZLE_DATABASE_URL ??
      'postgres://dev:dev@localhost:5432/leverie_dev',
  },
  strict: true,
  verbose: true,
} satisfies Config;
