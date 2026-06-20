// Read-only database connector (WP3). The query build + parameter binding are
// pure and unit-tested here; the actual connection/execution is injected via a
// DbQueryExecutor so this module never opens a socket during tests. A concrete
// pg-based executor lives in pgExecutor.ts and is only used on a Node runtime.
//
// Data-minimization: this connector reads ONE row at decision time and never
// copies the dataset into LEVERIE. Whether the values are persisted afterwards
// is governed by each fact's retention_policy (see masking.ts), not here.

import {
  collectParams,
  type DriverContext,
  type DriverResult,
  type ResolverDriver,
} from '../resolvers/driver.js';
import { projectRow } from '../resolvers/referenceTable.js';

// Reject anything that is not a single read-only SELECT. This is defense in
// depth on top of using a read-only DB role: no semicolons (one statement), and
// the statement must start with SELECT or WITH.
export function assertReadOnlyQuery(query: string): void {
  const trimmed = query.trim().replace(/;+\s*$/, '');
  if (trimmed.includes(';')) {
    throw new Error(
      'Only a single statement is allowed. Semicolons inside string literals or SQL comments are not supported — remove them or split into separate inputs.',
    );
  }
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error('Only read-only SELECT/WITH queries are allowed.');
  }
}

// Turn ":name" placeholders into ordered positional ones ($1, $2, …) in first
// appearance order, returning the rewritten SQL and the value array. Unknown
// placeholders (no supplied value) throw, so a missing bind can never silently
// become NULL. The negative lookbehind skips PostgreSQL's "::type" cast
// operator (e.g. `id::text`), which would otherwise be mistaken for a `:type`
// placeholder.
export function buildPositionalQuery(
  query: string,
  values: Record<string, string>,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const indexByName = new Map<string, number>();
  const sql = query.replace(
    /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (_, name: string) => {
      if (!(name in values)) {
        throw new Error(`Query parameter ":${name}" has no bound value.`);
      }
      let idx = indexByName.get(name);
      if (idx === undefined) {
        params.push(values[name]);
        idx = params.length;
        indexByName.set(name, idx);
      }
      return `$${idx}`;
    },
  );
  return { sql, params };
}

const DEFAULT_TIMEOUT_MS = 5000;

export const databaseDriver: ResolverDriver = {
  kind: 'db_query',
  sourceKind: 'api',
  async resolve(ctx: DriverContext): Promise<DriverResult> {
    if (ctx.operation.kind !== 'db_query') {
      return { matched: false, values: [], missingKeys: [] };
    }
    const executor = ctx.deps.queryExecutor;
    if (!executor) {
      // No executor wired (e.g. edge runtime without DB egress): treat as a
      // connector failure so the resolver fallback policy applies.
      return { matched: false, values: [], missingKeys: [] };
    }
    const params = collectParams(ctx.operation.params, ctx.availableFacts);
    if (!params.ok)
      return { matched: false, values: [], missingKeys: params.missing };

    assertReadOnlyQuery(ctx.operation.query);
    const { sql, params: positional } = buildPositionalQuery(
      ctx.operation.query,
      params.values,
    );
    const secret = ctx.source.secretRef
      ? ((await ctx.deps.getSecret?.(ctx.source.secretRef)) ?? null)
      : null;
    const timeoutMs =
      typeof ctx.source.config.timeoutMs === 'number'
        ? (ctx.source.config.timeoutMs as number)
        : DEFAULT_TIMEOUT_MS;

    const row = await executor.queryOne({
      secret,
      sql,
      params: positional,
      timeoutMs,
    });
    if (!row) return { matched: false, values: [], missingKeys: [] };

    const values = projectRow(
      row,
      ctx.outputMappings,
      ctx.factsById,
      {
        resolverRecipeId: ctx.resolverId,
        dataSourceId: ctx.source.id,
        sourceKindLabel: 'database',
        operationLabel: 'db_query',
        retrievedAt: ctx.now.toISOString(),
      },
      'api',
    );
    return { matched: true, values, missingKeys: [] };
  },
};
