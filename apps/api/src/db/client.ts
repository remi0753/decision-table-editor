import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>;

// Per-request DB factory. Workers isolates are request-bound; sharing a single
// instance across requests would leak fetch contexts between concurrent
// invocations. createDb() is cheap — it just wires neon() into Drizzle.
export function createDb(
  databaseUrl: string,
): ReturnType<typeof drizzle<typeof schema>> {
  // Local dev mode: redirect @neondatabase/serverless to the docker-compose
  // proxy on :4444. Production points at Neon Cloud directly so this branch
  // never fires.
  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    neonConfig.fetchEndpoint = (host) => {
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      const protocol = isLocal ? 'http' : 'https';
      const port = isLocal ? 4444 : 443;
      return `${protocol}://${host}:${port}/sql`;
    };
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
