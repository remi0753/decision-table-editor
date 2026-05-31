// P4.2 — Hosted Evaluate API. External systems (LLM agents, hosted MCP
// bridges, customer integrations) authenticate with an API key and call a
// published Logic version. The contract intentionally hides every internal id
// — inputs and outputs are keyed by field / column **names** so callers can
// derive shape from the metadata API (P4.3) without learning the editor's id
// scheme.
//
// Why this lives outside /api/*:
//   * /api/* is the browser surface (cookie-based session, CSRF gate, CORS
//     allow-list). /v1/* is the external surface (Bearer token, no cookies,
//     permissive CORS). Keeping them on separate path prefixes lets us
//     diverge their middleware without per-route conditionals and lets P4.6
//     publish an OpenAPI doc covering only /v1.
//
// Auth model:
//   * Authorization: Bearer lvr_<base64url>. We compute HMAC-SHA256 of the
//     raw secret under each active version of HMAC_KEY_RING_JSON and search
//     api_key by (lookup_secret_version, lookup_digest). A match is itself the
//     verifier: lookup_digest is a keyed HMAC of the secret, so matching a row
//     proves the caller holds the exact 32-byte random key — no extra hash
//     check is needed (the legacy scrypt key_hash is no longer verified per
//     request). Multiple ring versions are walked in order so server-secret
//     rotation can roll forward without invalidating live keys (design v6 §6.8).
//
// Version selection:
//   * version=production (default) | latest | vN. draft is intentionally NOT
//     callable via API key — drafts are mutable, unsnapshot'd, and frequently
//     inconsistent during editing; allowing them would let API consumers
//     observe in-flight authoring state and break the audit/replay model
//     execution_log assumes (a row references a specific logic_version_id).
//     This matches design v6 Q14.
//
// Rate limit:
//   * Per-key fixed window via secondaryStorage (Workers KV in prod, in-mem
//     locally). Sized for a small/medium agent workload; tighter or per-plan
//     limits land with P6 billing. We deliberately rate-limit *after* auth so
//     the noisy-neighbour identity is the key, not the IP.
//
// Persistence:
//   * Every call writes one execution_log row. status='ok'|'no_match' carry
//     inputs/result/trace; status='error' carries error_message/error_code
//     and nulls the payload columns to satisfy execution_log_status_payload_chk.
//   * api_key.last_used_at is bumped on every authenticated call. Q11 (design
//     v5) flags this as a hot-row risk; the bucketed/async migration lands
//     with P4.4 (hosted MCP) once we have real call volume to size it from.

import type { Logic, TraceStep } from '@leverie/engine';
import { evaluateTable } from '@leverie/engine';
import { type FormattedTraceStep, formatTrace } from '@leverie/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb, type Database } from '../db/client.js';
import {
  apiKey,
  apiKeyLogicScope,
  executionLog,
  logic,
  logicVersion,
  workspace,
} from '../db/schema.js';
import type { Env } from '../env.js';
import { checkFixedWindowRateLimit } from '../rateLimit.js';
import { type AppContext, getSecondaryStorage } from './shared.js';

// 60 req / 10s smooths short bursts (a single chat-of-thought issuing several
// tool calls in flight) while 600 / min caps sustained load so a runaway agent
// cannot turn a single key into a fan-out DoS. Both windows must pass; the
// stricter one trips first under sustained load.
const EVALUATE_RATE_LIMITS = [
  { suffix: '10s', windowSeconds: 10, max: 60 },
  { suffix: '1m', windowSeconds: 60, max: 600 },
] as const;

const REQUEST_ID_MAX = 200;
const INPUT_MAX_KEYS = 200;
const INPUT_VALUE_MAX = 4000;

export type ApiAuthError = {
  code: string;
  message: string;
  status: 400 | 401 | 403;
};

export type AuthenticatedKey = {
  apiKey: typeof apiKey.$inferSelect;
  workspace: typeof workspace.$inferSelect;
};

type KeyRingEntry = { version: string; secret: string };

export type VersionParam =
  | { kind: 'production' }
  | { kind: 'latest' }
  | { kind: 'version'; number: number };

export type ResolvedVersion = {
  type: 'production' | 'latest' | 'version';
  versionId: string;
  versionNumber: number;
  data: Logic;
  requestedNumber?: number;
};

export function jsonAuthError(error: ApiAuthError) {
  return {
    body: { error: { code: error.code, message: error.message } } as const,
    status: error.status,
  };
}

function parseKeyRingEntries(env: Env): KeyRingEntry[] {
  if (!env.HMAC_KEY_RING_JSON) return [];
  try {
    const parsed = JSON.parse(env.HMAC_KEY_RING_JSON) as {
      active?: unknown;
      keys?: unknown;
    };
    if (
      !parsed.keys ||
      typeof parsed.keys !== 'object' ||
      Array.isArray(parsed.keys)
    ) {
      return [];
    }
    const all = parsed.keys as Record<string, unknown>;
    const ordered: KeyRingEntry[] = [];
    const active = typeof parsed.active === 'string' ? parsed.active : null;
    if (active) {
      const secret = all[active];
      if (typeof secret === 'string' && secret.length >= 32) {
        ordered.push({ version: active, secret });
      }
    }
    for (const [version, secret] of Object.entries(all)) {
      if (version === active) continue;
      if (typeof secret !== 'string' || secret.length < 32) continue;
      ordered.push({ version, secret });
    }
    return ordered;
  } catch {
    return [];
  }
}

async function hmacSha256Base64Url(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  );
  const raw = Array.from(new Uint8Array(signature), (byte) =>
    String.fromCharCode(byte),
  ).join('');
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function authenticateApiKey(
  db: Database,
  env: Env,
  header: string | undefined,
): Promise<AuthenticatedKey | { error: ApiAuthError }> {
  if (!header) {
    return {
      error: {
        code: 'missing_authorization',
        message: 'Authorization header is required.',
        status: 401,
      },
    };
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) {
    return {
      error: {
        code: 'invalid_authorization',
        message: 'Authorization header must be "Bearer <key>".',
        status: 401,
      },
    };
  }
  const secret = match[1] as string;
  // Lightweight pre-check before paying the HMAC cost; an attacker spraying
  // random short strings should never reach the DB.
  if (!secret.startsWith('lvr_') || secret.length < 20) {
    return {
      error: {
        code: 'invalid_api_key',
        message: 'Invalid API key.',
        status: 401,
      },
    };
  }

  const entries = parseKeyRingEntries(env);
  if (entries.length === 0) {
    return {
      error: {
        code: 'api_key_secret_unconfigured',
        message: 'API key signing secret is not configured.',
        status: 401,
      },
    };
  }

  for (const entry of entries) {
    const digest = await hmacSha256Base64Url(entry.secret, secret);
    const [row] = await db
      .select({ apiKey, workspace })
      .from(apiKey)
      .innerJoin(workspace, eq(apiKey.workspaceId, workspace.id))
      .where(
        and(
          eq(apiKey.lookupSecretVersion, entry.version),
          eq(apiKey.lookupDigest, digest),
          isNull(workspace.deletedAt),
        ),
      )
      .limit(1);
    if (!row) continue;
    if (row.apiKey.revokedAt) {
      return {
        error: {
          code: 'api_key_revoked',
          message: 'API key was revoked.',
          status: 401,
        },
      };
    }
    if (row.apiKey.expiresAt && row.apiKey.expiresAt.getTime() <= Date.now()) {
      return {
        error: {
          code: 'api_key_expired',
          message: 'API key has expired.',
          status: 401,
        },
      };
    }
    // The keyed-HMAC lookup is itself the verifier: lookup_digest is
    // HMAC(server_secret, presented_key), so matching a row already proves the
    // caller holds the exact 32-byte random secret (an attacker cannot forge a
    // digest without both the server key ring and the secret). The stored
    // scrypt key_hash added no real protection for a high-entropy key, only
    // per-request KDF latency, so we no longer verify against it. key_hash
    // remains written at creation (NOT NULL) and is now vestigial.
    return { apiKey: row.apiKey, workspace: row.workspace };
  }

  return {
    error: {
      code: 'invalid_api_key',
      message: 'Invalid API key.',
      status: 401,
    },
  };
}

export function parseVersionParam(
  value: string | undefined,
): VersionParam | null {
  const label = value && value.length > 0 ? value : 'production';
  if (label === 'production' || label === 'latest') return { kind: label };
  const match = /^v([1-9][0-9]{0,8})$/.exec(label);
  if (!match) return null;
  return { kind: 'version', number: Number(match[1]) };
}

export async function resolveVersion(
  db: Database,
  existing: typeof logic.$inferSelect,
  param: VersionParam,
): Promise<ResolvedVersion | null> {
  if (param.kind === 'production') {
    if (!existing.productionVersionId) return null;
    const [row] = await db
      .select()
      .from(logicVersion)
      .where(eq(logicVersion.id, existing.productionVersionId))
      .limit(1);
    if (!row) return null;
    return {
      type: 'production',
      versionId: row.id,
      versionNumber: row.versionNumber,
      data: row.data as Logic,
    };
  }

  if (param.kind === 'latest') {
    const [row] = await db
      .select()
      .from(logicVersion)
      .where(eq(logicVersion.logicId, existing.id))
      .orderBy(desc(logicVersion.versionNumber))
      .limit(1);
    if (!row) return null;
    return {
      type: 'latest',
      versionId: row.id,
      versionNumber: row.versionNumber,
      data: row.data as Logic,
    };
  }

  const [row] = await db
    .select()
    .from(logicVersion)
    .where(
      and(
        eq(logicVersion.logicId, existing.id),
        eq(logicVersion.versionNumber, param.number),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    type: 'version',
    versionId: row.id,
    versionNumber: row.versionNumber,
    data: row.data as Logic,
    requestedNumber: param.number,
  };
}

// Normalise inputs to a string-keyed/string-valued record. The engine coerces
// per fieldType, so accepting numbers / booleans here means JSON callers don't
// have to stringify everything themselves. Anything else (array, object, null)
// is dropped — passing a structured value where a scalar belongs is a caller
// bug, and silently dropping is friendlier than 400ing on a single bad field.
// Shared between the REST route (which receives `{ inputs: {...} }` in the
// body) and the MCP route (whose JSON-RPC tools/call passes `arguments` as the
// inputs object directly). Both surfaces hit the same field-name / type-coercion
// contract the engine expects.
export function coerceInputs(
  raw: unknown,
): { inputs: Record<string, string> } | { error: ApiAuthError } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      error: {
        code: 'invalid_inputs',
        message: 'inputs must be a JSON object.',
        status: 400,
      },
    };
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > INPUT_MAX_KEYS) {
    return {
      error: {
        code: 'invalid_inputs',
        message: `inputs object may contain at most ${INPUT_MAX_KEYS} keys.`,
        status: 400,
      },
    };
  }
  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (value === null || value === undefined) continue;
    let serialized: string;
    if (typeof value === 'string') serialized = value;
    else if (typeof value === 'number' && Number.isFinite(value)) {
      serialized = String(value);
    } else if (typeof value === 'boolean')
      serialized = value ? 'true' : 'false';
    else continue;
    if (serialized.length > INPUT_VALUE_MAX) {
      return {
        error: {
          code: 'invalid_inputs',
          message: `inputs.${key} exceeds ${INPUT_VALUE_MAX} chars.`,
          status: 400,
        },
      };
    }
    result[key] = serialized;
  }
  return { inputs: result };
}

export function normaliseInputs(
  body: unknown,
): { inputs: Record<string, string> } | { error: ApiAuthError } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      error: {
        code: 'invalid_request',
        message: 'Request body must be a JSON object.',
        status: 400,
      },
    };
  }
  const inputs = (body as { inputs?: unknown }).inputs;
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    return {
      error: {
        code: 'invalid_inputs',
        message: 'Request body must include an "inputs" object.',
        status: 400,
      },
    };
  }
  return coerceInputs(inputs);
}

export function outputsByName(
  logicData: Logic,
  outputs: Record<string, string>,
) {
  // Walk every table once to map output column id → name. Different tables
  // may share a name on purpose — the union shape is the same as what
  // logicToOutputSchema advertises to LLMs.
  const idToName = new Map<string, string>();
  for (const table of Object.values(logicData.tables)) {
    for (const col of table.outputCols) idToName.set(col.id, col.name);
  }
  const result: Record<string, string> = {};
  for (const [id, value] of Object.entries(outputs)) {
    result[idToName.get(id) ?? id] = value;
  }
  return result;
}

export function unmatchedTableName(logicData: Logic, tableId: string): string {
  return logicData.tables[tableId]?.name ?? tableId;
}

// A waitUntil-backed write deferral, or undefined when no execution context is
// available (Node adapter / tests) so the rate-limit counter is awaited there.
function deferToExecutionCtx(
  c: AppContext,
): ((work: Promise<unknown>) => void) | undefined {
  try {
    const ctx = c.executionCtx;
    return (work) => {
      ctx.waitUntil(work.catch(() => {}));
    };
  } catch {
    return undefined;
  }
}

export async function enforceEvaluateRateLimit(
  c: AppContext,
  apiKeyId: string,
) {
  const storage = getSecondaryStorage(c);
  return checkFixedWindowRateLimit(
    storage,
    EVALUATE_RATE_LIMITS.map((rule) => ({
      key: `evaluate:api_key:${apiKeyId}:${rule.suffix}`,
      max: rule.max,
      windowSeconds: rule.windowSeconds,
    })),
    Date.now(),
    deferToExecutionCtx(c),
  );
}

export async function recordExecutionLog(
  db: Database,
  input: {
    workspaceId: string;
    logicId: string;
    apiKeyId: string;
    requestedVersionType: 'latest' | 'production' | 'version';
    requestedVersionNumber: number | null;
    resolvedVersionNumber: number;
    versionId: string;
    inputs: Record<string, string>;
    status: 'ok' | 'no_match';
    outputs: Record<string, string> | null;
    unmatchedTableName: string | null;
    formattedTrace: FormattedTraceStep[];
    latencyMs: number;
    requestId: string;
  },
) {
  await db.insert(executionLog).values({
    workspaceId: input.workspaceId,
    logicId: input.logicId,
    logicVersionId: input.versionId,
    requestedVersionType: input.requestedVersionType,
    requestedVersionNumber: input.requestedVersionNumber,
    resolvedVersionNumber: input.resolvedVersionNumber,
    inputs: input.inputs,
    result:
      input.status === 'ok'
        ? { status: 'ok', outputs: input.outputs ?? {} }
        : { status: 'no_match', unmatchedTable: input.unmatchedTableName },
    trace: input.formattedTrace,
    status: input.status,
    callerActorType: 'api_key',
    callerChannel: 'api_key',
    callerApiKeyId: input.apiKeyId,
    requestId: input.requestId,
    latencyMs: input.latencyMs,
  });
}

// Best-effort hot-path bump; failure here must not poison a successful
// evaluate. Hot-row risk on a high-volume key is tracked as Q11 (design v5)
// and will move to a bucketed update with P4.4. The Drizzle update is a
// PromiseLike (no .catch), so we wrap it in try/await. Shared between the REST
// evaluate route and the hosted MCP route.
export async function touchApiKeyLastUsedAt(db: Database, apiKeyId: string) {
  try {
    await db
      .update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.id, apiKeyId));
  } catch {
    // swallow — last_used_at is observability, not correctness.
  }
}

// Run post-response side effects (execution-log write, last_used bump) off the
// request's critical path. On Workers, executionCtx.waitUntil keeps the isolate
// alive until `work` settles without blocking the response — these two DB
// round trips otherwise add their latency to what the caller waits for. When no
// execution context is available (Node adapter, tests), fall back to awaiting so
// the work still completes before the handler returns. `work` is expected to
// swallow its own errors; these effects are best-effort.
export async function runAfterResponse(
  c: AppContext,
  work: Promise<unknown>,
): Promise<void> {
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    await work;
  }
}

export async function recordErrorExecutionLog(
  db: Database,
  input: {
    workspaceId: string;
    logicId: string;
    apiKeyId: string;
    requestedVersionType: 'latest' | 'production' | 'version';
    requestedVersionNumber: number | null;
    errorCode: string;
    errorMessage: string;
    latencyMs: number;
    requestId: string;
  },
) {
  await db.insert(executionLog).values({
    workspaceId: input.workspaceId,
    logicId: input.logicId,
    requestedVersionType: input.requestedVersionType,
    requestedVersionNumber: input.requestedVersionNumber,
    status: 'error',
    callerActorType: 'api_key',
    callerChannel: 'api_key',
    callerApiKeyId: input.apiKeyId,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    requestId: input.requestId,
    latencyMs: input.latencyMs,
  });
}

export const evaluateRoutes = new Hono<{ Bindings: Env }>();

evaluateRoutes.post('/v1/logics/:logicId/evaluate', async (c) => {
  const startedAt = Date.now();
  const requestIdHeader = c.req.header('x-request-id');
  const requestId =
    requestIdHeader &&
    requestIdHeader.length > 0 &&
    requestIdHeader.length <= REQUEST_ID_MAX
      ? requestIdHeader
      : crypto.randomUUID();

  const db = createDb(c.env.DATABASE_URL);

  const auth = await authenticateApiKey(
    db,
    c.env,
    c.req.header('authorization'),
  );
  if ('error' in auth) {
    const { body, status } = jsonAuthError(auth.error);
    return c.json(body, status);
  }

  const rateLimit = await enforceEvaluateRateLimit(c, auth.apiKey.id);
  if (!rateLimit.allowed) {
    return c.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Evaluate rate limit exceeded for this API key.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
      },
      429,
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  const logicId = c.req.param('logicId');
  const [logicRow] = await db
    .select()
    .from(logic)
    .where(
      and(
        eq(logic.id, logicId),
        eq(logic.workspaceId, auth.workspace.id),
        isNull(logic.deletedAt),
      ),
    )
    .limit(1);

  if (!logicRow) {
    return c.json(
      {
        error: {
          code: 'not_found',
          message: 'Logic not found in the API key workspace.',
        },
      },
      404,
    );
  }

  if (auth.apiKey.scopeMode === 'allowlist') {
    const [scopeRow] = await db
      .select({ logicId: apiKeyLogicScope.logicId })
      .from(apiKeyLogicScope)
      .where(
        and(
          eq(apiKeyLogicScope.workspaceId, auth.workspace.id),
          eq(apiKeyLogicScope.apiKeyId, auth.apiKey.id),
          eq(apiKeyLogicScope.logicId, logicId),
        ),
      )
      .limit(1);
    if (!scopeRow) {
      return c.json(
        {
          error: {
            code: 'logic_not_in_scope',
            message:
              'This API key does not have access to the requested logic.',
          },
        },
        403,
      );
    }
  }

  const versionParam = parseVersionParam(c.req.query('version'));
  if (!versionParam) {
    return c.json(
      {
        error: {
          code: 'invalid_version',
          message:
            'version must be "production", "latest", or "vN" (positive integer).',
        },
      },
      400,
    );
  }

  const version = await resolveVersion(db, logicRow, versionParam);
  if (!version) {
    return c.json(
      {
        error: {
          code: 'no_published_version',
          message:
            versionParam.kind === 'version'
              ? `Version v${versionParam.number} was not found.`
              : versionParam.kind === 'production'
                ? 'This logic has no production version pinned.'
                : 'This logic has no published versions.',
        },
      },
      404,
    );
  }

  const requestedVersionType: 'latest' | 'production' | 'version' =
    version.type;
  const requestedVersionNumber =
    requestedVersionType === 'version' ? version.versionNumber : null;

  const body = await c.req.json().catch(() => null);
  const normalised = normaliseInputs(body);
  if ('error' in normalised) {
    const latencyMs = Date.now() - startedAt;
    await recordErrorExecutionLog(db, {
      workspaceId: auth.workspace.id,
      logicId: logicRow.id,
      apiKeyId: auth.apiKey.id,
      requestedVersionType,
      requestedVersionNumber,
      errorCode: normalised.error.code,
      errorMessage: normalised.error.message,
      latencyMs,
      requestId,
    });
    const { body: errorBody, status } = jsonAuthError(normalised.error);
    return c.json(errorBody, status);
  }

  let engineStatus: 'ok' | 'no_match' = 'ok';
  let outputsResponse: Record<string, string> | null = null;
  let unmatchedTable: string | null = null;
  let trace: TraceStep[] = [];
  try {
    const result = evaluateTable(
      version.data.entryTableId,
      normalised.inputs,
      version.data,
    );
    trace = result.trace;
    if (result.status === 'ok') {
      engineStatus = 'ok';
      outputsResponse = outputsByName(version.data, result.outputs);
    } else {
      engineStatus = 'no_match';
      unmatchedTable = unmatchedTableName(version.data, result.tableId);
    }
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : 'evaluation_failed';
    await recordErrorExecutionLog(db, {
      workspaceId: auth.workspace.id,
      logicId: logicRow.id,
      apiKeyId: auth.apiKey.id,
      requestedVersionType,
      requestedVersionNumber,
      errorCode: 'evaluation_failed',
      errorMessage: message.slice(0, 2000),
      latencyMs,
      requestId,
    });
    return c.json(
      {
        error: {
          code: 'evaluation_failed',
          message: 'Evaluation failed unexpectedly.',
        },
      },
      500,
    );
  }

  const formattedTrace = formatTrace(version.data, trace);
  const latencyMs = Date.now() - startedAt;

  // Defer the execution-log write and last_used bump off the response path.
  // Kept sequential so writes land in a stable order (log, then last_used).
  await runAfterResponse(
    c,
    (async () => {
      try {
        await recordExecutionLog(db, {
          workspaceId: auth.workspace.id,
          logicId: logicRow.id,
          apiKeyId: auth.apiKey.id,
          requestedVersionType,
          requestedVersionNumber,
          resolvedVersionNumber: version.versionNumber,
          versionId: version.versionId,
          inputs: normalised.inputs,
          status: engineStatus,
          outputs: outputsResponse,
          unmatchedTableName: unmatchedTable,
          formattedTrace,
          latencyMs,
          requestId,
        });
        await touchApiKeyLastUsedAt(db, auth.apiKey.id);
      } catch (err) {
        console.error('evaluate post-response write failed', err);
      }
    })(),
  );

  return c.json({
    logic: {
      id: logicRow.id,
      slug: logicRow.slug,
      name: logicRow.name,
    },
    version: {
      id: version.versionId,
      versionNumber: version.versionNumber,
      requestedType: requestedVersionType,
    },
    result:
      engineStatus === 'ok'
        ? { status: 'ok' as const, outputs: outputsResponse ?? {} }
        : { status: 'no_match' as const, unmatchedTable },
    trace: formattedTrace,
    requestId,
    latencyMs,
  });
});
