// Optional DB query executor registry (WP3). The edge runtime cannot open raw
// TCP to a customer database, so no executor is registered there and db_query
// resolvers fall back per policy. A Node self-host can import ./pgExecutor to
// register a pg-backed executor at startup. Keeping the executor out of the
// default import graph keeps `pg` out of the edge bundle.

import type { DbQueryExecutor } from '../resolvers/driver.js';

let executor: DbQueryExecutor | undefined;

export function setDbQueryExecutor(impl: DbQueryExecutor | undefined): void {
  executor = impl;
}

export function getDbQueryExecutor(): DbQueryExecutor | undefined {
  return executor;
}
