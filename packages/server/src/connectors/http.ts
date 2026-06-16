// Read-only HTTP / OpenAPI connector (WP4). Builds a GET request from the
// operation template + input facts, enforces a domain allow-list, injects auth
// server-side, applies a timeout, and projects the JSON response into facts.
// `fetch` is injected so the request build + response extraction are unit
// testable without real network access.
//
// Edge-compatible: uses the platform `fetch`, so this is the recommended live
// connector when LEVERIE runs on a serverless/edge runtime where raw DB sockets
// are unavailable. Data-minimization is the same as the DB connector: one
// request per case, retention governed by each fact's retention_policy.

import {
  type ConnectorSecret,
  collectParams,
  type DriverContext,
  type DriverResult,
  type ResolverDriver,
} from '../resolvers/driver.js';
import { projectRow, readField } from '../resolvers/referenceTable.js';

// Fill {name} placeholders in the URL template, URL-encoding each value. Values
// not present throw, so a missing bind cannot silently produce a bad URL.
export function buildRequestUrl(
  urlTemplate: string,
  values: Record<string, string>,
): string {
  return urlTemplate.replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (_, name: string) => {
      if (!(name in values)) {
        throw new Error(`URL parameter "{${name}}" has no bound value.`);
      }
      return encodeURIComponent(values[name] ?? '');
    },
  );
}

// The URL host must match one of the allowed domains exactly or as a subdomain.
// An empty/absent allow-list denies everything (fail closed).
export function isDomainAllowed(
  url: string,
  allowedDomains: string[],
): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedDomains.some((d) => {
    const domain = d.trim().toLowerCase();
    if (!domain) return false;
    return host === domain || host.endsWith(`.${domain}`);
  });
}

// Build the auth headers for a connector secret. Only server-side.
export function buildAuthHeaders(
  secret: ConnectorSecret | null,
): Record<string, string> {
  if (!secret) return {};
  switch (secret.authType) {
    case 'bearer':
      return secret.value.token
        ? { Authorization: `Bearer ${secret.value.token}` }
        : {};
    case 'api_key':
      return secret.value.key
        ? { [secret.value.header || 'X-API-Key']: secret.value.key }
        : {};
    case 'basic':
      if (secret.value.username !== undefined) {
        const encoded = btoa(
          `${secret.value.username}:${secret.value.password ?? ''}`,
        );
        return { Authorization: `Basic ${encoded}` };
      }
      return {};
    default:
      return {};
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

export const httpDriver: ResolverDriver = {
  kind: 'http_operation',
  sourceKind: 'api',
  async resolve(ctx: DriverContext): Promise<DriverResult> {
    if (ctx.operation.kind !== 'http_operation') {
      return { matched: false, values: [], missingKeys: [] };
    }
    const fetchFn = ctx.deps.fetchFn ?? globalThis.fetch;
    if (!fetchFn) return { matched: false, values: [], missingKeys: [] };

    const params = collectParams(ctx.operation.params, ctx.availableFacts);
    if (!params.ok)
      return { matched: false, values: [], missingKeys: params.missing };

    const url = buildRequestUrl(ctx.operation.urlTemplate, params.values);
    const allowedDomains = Array.isArray(ctx.source.config.allowedDomains)
      ? (ctx.source.config.allowedDomains as string[])
      : [];
    if (!isDomainAllowed(url, allowedDomains)) {
      throw new Error('Request URL is not in the data source allow-list.');
    }

    const secret = ctx.source.secretRef
      ? ((await ctx.deps.getSecret?.(ctx.source.secretRef)) ?? null)
      : null;
    const timeoutMs =
      typeof ctx.source.config.timeoutMs === 'number'
        ? (ctx.source.config.timeoutMs as number)
        : DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...buildAuthHeaders(secret) },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      if (response.status === 404)
        return { matched: false, values: [], missingKeys: [] };
      throw new Error(`Source responded ${response.status}.`);
    }

    const body = (await response.json()) as unknown;
    const record = extractRecord(body, ctx.operation.recordPath);
    if (!record) return { matched: false, values: [], missingKeys: [] };

    const values = projectRow(
      record,
      ctx.outputMappings,
      ctx.factsById,
      {
        resolverRecipeId: ctx.resolverId,
        dataSourceId: ctx.source.id,
        sourceKindLabel: 'http',
        operationLabel: url.split('?')[0],
        retrievedAt: ctx.now.toISOString(),
      },
      'api',
    );
    return { matched: true, values, missingKeys: [] };
  },
};

// Pull the record object out of the response body, following an optional dotted
// path (e.g. "data.order"). Arrays resolve to their first element.
export function extractRecord(
  body: unknown,
  recordPath?: string,
): Record<string, unknown> | null {
  let cursor: unknown = body;
  if (recordPath) {
    cursor = readField(
      (typeof body === 'object' && body !== null ? body : {}) as Record<
        string,
        unknown
      >,
      recordPath,
    );
  }
  if (Array.isArray(cursor)) cursor = cursor[0];
  if (cursor === null || typeof cursor !== 'object') return null;
  return cursor as Record<string, unknown>;
}
