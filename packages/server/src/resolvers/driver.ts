// Resolver driver abstraction (WP0). The runtime no longer hard-codes reference
// tables: each data-source kind provides a driver that, given the available
// input facts, fetches at most one record and projects it into fact values.
// Reference-table lookup stays inline in runtime.ts for backward compatibility;
// live sources (database, http) are pluggable drivers registered here.

import type {
  DecisionFactSourceKind,
  FactView,
  OperationRef,
  OutputMapping,
  ParameterBinding,
  ResolvedFactValue,
} from './types.js';

// A data source as seen by a driver at decision time. `config` carries the
// kind-specific connection metadata snapshotted at publish (base URL, allowed
// domains, auth type, secret reference, …). Secrets themselves are never in
// here — only a `secretRef` the runtime resolves through `getSecret`.
export interface DriverDataSource {
  id: string;
  kind: string;
  config: Record<string, unknown>;
  secretRef?: string | null;
}

export interface ConnectorSecret {
  authType: string;
  // Decrypted secret material, server-side only.
  value: Record<string, string>;
}

// Everything a driver may need, injected so the pure drivers stay testable
// without real network/DB access.
export interface DriverDeps {
  fetchFn?: typeof fetch;
  queryExecutor?: DbQueryExecutor;
  getSecret?: (secretRef: string) => Promise<ConnectorSecret | null>;
}

export interface DbQueryExecutor {
  // Run a read-only parameterized query and return the first row, or null.
  queryOne(input: {
    secret: ConnectorSecret | null;
    sql: string;
    params: unknown[];
    timeoutMs: number;
  }): Promise<Record<string, unknown> | null>;
}

export interface DriverContext {
  resolverId: string;
  operation: OperationRef;
  source: DriverDataSource;
  outputMappings: OutputMapping[];
  availableFacts: Map<string, string>;
  factsById: Map<string, FactView>;
  now: Date;
  deps: DriverDeps;
}

export interface DriverResult {
  matched: boolean;
  values: ResolvedFactValue[];
  // input keys (parameter facts) that had no value yet, so the resolver is
  // skipped this pass rather than treated as "no record found".
  missingKeys: string[];
}

export interface ResolverDriver {
  kind: OperationRef['kind'];
  sourceKind: DecisionFactSourceKind;
  resolve(ctx: DriverContext): Promise<DriverResult>;
}

// Collect the parameter values from the available facts, reporting any that are
// not yet available so the runtime can defer the resolver to a later pass.
export function collectParams(
  params: ParameterBinding[],
  availableFacts: Map<string, string>,
):
  | { ok: true; values: Record<string, string> }
  | { ok: false; missing: string[] } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of params) {
    const v = availableFacts.get(p.factId);
    if (v === undefined || v === '') missing.push(p.name);
    else values[p.name] = v;
  }
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, values };
}

const registry = new Map<string, ResolverDriver>();

export function registerDriver(driver: ResolverDriver): void {
  registry.set(driver.kind, driver);
}

export function getDriver(kind: string): ResolverDriver | undefined {
  return registry.get(kind);
}
