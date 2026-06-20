// Node-only pg-backed DB executor (WP3). Import this module once at startup on a
// Node deployment to enable db_query live resolvers:
//
//   import { registerPgExecutor } from '@leverie/server/connectors/pgExecutor';
//   registerPgExecutor();
//
// It is intentionally NOT imported anywhere in the default graph so the edge
// bundle never pulls in `pg`. Connection URLs come from the connector secret
// (authType 'database_url'); a short-lived pool per URL is reused across calls.

import { Pool } from 'pg';
import type { DbQueryExecutor } from '../resolvers/driver.js';
import { setDbQueryExecutor } from './dbExecutorRegistry.js';

const pools = new Map<string, Pool>();

function poolFor(connectionString: string): Pool {
  let pool = pools.get(connectionString);
  if (!pool) {
    // Read-only intent: a small pool, and the connector requires a read-only DB
    // role on the customer side (assertReadOnlyQuery is defense in depth).
    pool = new Pool({ connectionString, max: 3 });
    pools.set(connectionString, pool);
  }
  return pool;
}

export const pgExecutor: DbQueryExecutor = {
  async queryOne({ secret, sql, params, timeoutMs }) {
    const connectionString = secret?.value.url;
    if (!connectionString)
      throw new Error('Database connector has no URL secret.');
    const pool = poolFor(connectionString);
    const client = await pool.connect();
    try {
      await client.query(
        `SET statement_timeout = ${Math.max(1, Math.floor(timeoutMs))}`,
      );
      const result = await client.query(sql, params);
      return result.rows[0] ?? null;
    } finally {
      client.release();
    }
  },
};

export function registerPgExecutor(): void {
  setDbQueryExecutor(pgExecutor);
}
