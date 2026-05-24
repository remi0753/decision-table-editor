// P4.3 — Hosted MCP server. Cloud-side counterpart to the Standalone MCP CLI
// (`leverie-mcp serve`): external LLM agents connect with an API key and the
// server exposes every logic in scope as a callable MCP tool with input /
// output JSON Schemas derived from `@leverie/schema`.
//
// Transport: stateless JSON-RPC 2.0 over HTTP POST. Each request is a complete
// MCP message; the server holds no session state between requests. This trades
// the bidirectional streamable-HTTP transport away for Workers-friendly
// statelessness — clients that need persistent sessions can either reissue
// `initialize` per request or fall back to the Standalone MCP CLI. The
// stateless choice is intentional and documented in roadmap P4.3.
//
// Why same /v1/* prefix as evaluate, not /mcp/*:
//   * Same auth model (Bearer API key), same rate-limit semantics, same
//     execution_log persistence, same OpenAPI documentation surface for P4.6.
//     Keeping them under one prefix lets us share middleware via the Hono
//     /v1/* mount in src/index.ts.
//
// Tool model:
//   * One MCP tool per logic with a published production version. Tools
//     without a pinned production are intentionally hidden from tools/list
//     because tools/call would only error out — surfacing them would pollute
//     the LLM's tool catalog with non-functional entries.
//   * Tool name is `logic.slug` (DB-unique per workspace, slug-shaped). Stable
//     across renames of `logic.name`, which matters for LLM agents that cache
//     tool selections.
//   * tools/call evaluates against the production snapshot. Drafts and
//     `latest` are intentionally NOT reachable via MCP for the same reason
//     `?version=draft` is rejected by the REST evaluate route: drafts are
//     mutable and inconsistent during editing.
//
// Method coverage:
//   * initialize        — server info, capabilities, protocolVersion echo
//   * notifications/*   — accepted but produce no response (per JSON-RPC spec)
//   * tools/list        — enumerate accessible logics
//   * tools/call        — evaluate one logic; mirrors the REST evaluate route
//   * ping              — health check used by some MCP clients

import type { Logic, TraceStep } from '@leverie/engine';
import { evaluateTable } from '@leverie/engine';
import {
  formatTrace,
  logicToInputSchema,
  logicToOutputSchema,
  logicToToolDescription,
} from '@leverie/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb, type Database } from '../db/client.js';
import { apiKeyLogicScope, logic, logicVersion } from '../db/schema.js';
import type { Env } from '../env.js';
import {
  type AuthenticatedKey,
  authenticateApiKey,
  coerceInputs,
  enforceEvaluateRateLimit,
  outputsByName,
  recordErrorExecutionLog,
  recordExecutionLog,
  touchApiKeyLastUsedAt,
  unmatchedTableName,
} from './evaluate.js';

// MCP spec versions the server understands. The wire format we emit hasn't
// diverged across these revisions; we echo the client's protocolVersion when
// it's in this set, otherwise fall back to the latest. Keeping this list
// explicit (instead of accepting any string) means a future incompatible
// revision will surface as a visible mismatch rather than a silent shape drift.
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  '2024-11-05',
  '2025-03-26',
  '2025-06-18',
]);
const LATEST_PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'leverie-mcp-hosted', version: '0.1.0' } as const;

// JSON-RPC 2.0 error codes (spec § 5.1). MCP also reserves -32000..-32099 for
// server errors but the spec keeps them implementation-defined; we stick to
// the standard codes here and put MCP-specific failures (e.g. tool execution
// errors) in tools/call's `result.isError` channel instead.
const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_INVALID_PARAMS = -32602;
const JSON_RPC_INTERNAL_ERROR = -32603;

const MAX_TOOLS_LIST = 200;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcResponse =
  | {
      jsonrpc: '2.0';
      id: JsonRpcId;
      result: unknown;
    }
  | {
      jsonrpc: '2.0';
      id: JsonRpcId;
      error: { code: number; message: string; data?: unknown };
    };

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as { jsonrpc?: unknown; method?: unknown };
  return v.jsonrpc === '2.0' && typeof v.method === 'string';
}

function isNotification(req: JsonRpcRequest) {
  // Per JSON-RPC, `id` absent (NOT just null) means notification. Most MCP
  // clients send `notifications/initialized` without an id.
  return !('id' in req) || req.id === undefined;
}

function pickProtocolVersion(value: unknown): string {
  if (typeof value === 'string' && SUPPORTED_PROTOCOL_VERSIONS.has(value)) {
    return value;
  }
  return LATEST_PROTOCOL_VERSION;
}

type AccessibleLogicRow = {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description: string | null;
  productionVersionId: string;
};

// Pull every logic the API key can reach AND that has a production version
// pinned. Two paths because scope=all unions the workspace, scope=allowlist
// restricts to the join table. Both apply isNull(logic.deletedAt) and isNotNull
// on productionVersionId — surfacing a tool without a snapshot would mean the
// next tools/call returns 'no_published_version', which is worse for LLM UX
// than just not advertising the tool.
async function loadAccessibleLogics(
  db: Database,
  auth: AuthenticatedKey,
): Promise<AccessibleLogicRow[]> {
  if (auth.apiKey.scopeMode === 'all') {
    const rows = await db
      .select({
        id: logic.id,
        workspaceId: logic.workspaceId,
        slug: logic.slug,
        name: logic.name,
        description: logic.description,
        productionVersionId: logic.productionVersionId,
      })
      .from(logic)
      .where(
        and(eq(logic.workspaceId, auth.workspace.id), isNull(logic.deletedAt)),
      )
      .limit(MAX_TOOLS_LIST);
    return rows
      .filter((r): r is AccessibleLogicRow => r.productionVersionId !== null)
      .slice(0, MAX_TOOLS_LIST);
  }

  // allowlist mode: intersect logic ⋈ api_key_logic_scope.
  const rows = await db
    .select({
      id: logic.id,
      workspaceId: logic.workspaceId,
      slug: logic.slug,
      name: logic.name,
      description: logic.description,
      productionVersionId: logic.productionVersionId,
    })
    .from(logic)
    .innerJoin(
      apiKeyLogicScope,
      and(
        eq(apiKeyLogicScope.logicId, logic.id),
        eq(apiKeyLogicScope.apiKeyId, auth.apiKey.id),
        eq(apiKeyLogicScope.workspaceId, auth.workspace.id),
      ),
    )
    .where(
      and(eq(logic.workspaceId, auth.workspace.id), isNull(logic.deletedAt)),
    )
    .limit(MAX_TOOLS_LIST);
  return rows
    .filter((r): r is AccessibleLogicRow => r.productionVersionId !== null)
    .slice(0, MAX_TOOLS_LIST);
}

async function loadLogicVersionData(
  db: Database,
  versionIds: string[],
): Promise<Map<string, { versionNumber: number; data: Logic }>> {
  if (versionIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: logicVersion.id,
      versionNumber: logicVersion.versionNumber,
      data: logicVersion.data,
    })
    .from(logicVersion)
    .where(inArray(logicVersion.id, versionIds));
  const map = new Map<string, { versionNumber: number; data: Logic }>();
  for (const row of rows) {
    map.set(row.id, {
      versionNumber: row.versionNumber,
      data: row.data as Logic,
    });
  }
  return map;
}

function toolDefinition(
  logicRow: AccessibleLogicRow,
  logicData: Logic,
  versionNumber: number,
) {
  // Annotate description with the version number so the LLM can quote it back
  // in chat ("calling refund_eligibility v3"), and so the catalog itself is
  // version-aware without requiring a separate metadata round-trip.
  const base = logicToToolDescription(logicData);
  return {
    name: logicRow.slug,
    description: `${base}\n\nVersion: v${versionNumber} (production).`,
    inputSchema: logicToInputSchema(logicData),
    outputSchema: logicToOutputSchema(logicData),
  };
}

async function handleToolsList(
  db: Database,
  auth: AuthenticatedKey,
): Promise<unknown> {
  const accessible = await loadAccessibleLogics(db, auth);
  const versionIds = accessible.map((r) => r.productionVersionId);
  const versionMap = await loadLogicVersionData(db, versionIds);
  const tools = [];
  for (const row of accessible) {
    const versionEntry = versionMap.get(row.productionVersionId);
    if (!versionEntry) continue;
    tools.push(
      toolDefinition(row, versionEntry.data, versionEntry.versionNumber),
    );
  }
  return { tools };
}

type ToolCallParams = {
  name?: unknown;
  arguments?: unknown;
};

function badParams(message: string): {
  error: { code: number; message: string };
} {
  return { error: { code: JSON_RPC_INVALID_PARAMS, message } };
}

// MCP convention: tool execution failures DO NOT surface as JSON-RPC errors —
// they come back as a normal `result` with `isError: true` and an explanatory
// `content` entry. That lets the LLM see the failure message and recover.
// Reserve JSON-RPC errors for protocol-level problems (auth, unknown tool,
// malformed args).
function toolErrorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

async function handleToolsCall(
  db: Database,
  auth: AuthenticatedKey,
  requestId: string,
  params: unknown,
): Promise<
  | { result: unknown }
  | { error: { code: number; message: string; data?: unknown } }
> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return badParams('tools/call params must be an object.');
  }
  const { name, arguments: argsRaw } = params as ToolCallParams;
  if (typeof name !== 'string' || name.length === 0) {
    return badParams('tools/call requires a non-empty "name".');
  }

  // Resolve tool name → logic row. Re-checking scope here (rather than trusting
  // the tools/list filter) closes the gap where a key gets de-scoped between
  // list and call.
  const accessible = await loadAccessibleLogics(db, auth);
  const logicRow = accessible.find((row) => row.slug === name);
  if (!logicRow) {
    return badParams(`Tool "${name}" is not available to this API key.`);
  }

  const versionMap = await loadLogicVersionData(db, [
    logicRow.productionVersionId,
  ]);
  const versionEntry = versionMap.get(logicRow.productionVersionId);
  if (!versionEntry) {
    return badParams(
      `Tool "${name}" has no resolvable production snapshot. Re-publish the logic.`,
    );
  }

  const startedAt = Date.now();
  const coerced = coerceInputs(argsRaw === undefined ? {} : argsRaw);
  if ('error' in coerced) {
    const latencyMs = Date.now() - startedAt;
    await recordErrorExecutionLog(db, {
      workspaceId: auth.workspace.id,
      logicId: logicRow.id,
      apiKeyId: auth.apiKey.id,
      requestedVersionType: 'production',
      requestedVersionNumber: null,
      errorCode: coerced.error.code,
      errorMessage: coerced.error.message,
      latencyMs,
      requestId,
    });
    return { result: toolErrorResult(coerced.error.message) };
  }

  let engineStatus: 'ok' | 'no_match' = 'ok';
  let outputsResponse: Record<string, string> | null = null;
  let unmatchedTable: string | null = null;
  let trace: TraceStep[] = [];
  try {
    const evalResult = evaluateTable(
      versionEntry.data.entryTableId,
      coerced.inputs,
      versionEntry.data,
    );
    trace = evalResult.trace;
    if (evalResult.status === 'ok') {
      outputsResponse = outputsByName(versionEntry.data, evalResult.outputs);
    } else {
      engineStatus = 'no_match';
      unmatchedTable = unmatchedTableName(
        versionEntry.data,
        evalResult.tableId,
      );
    }
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : 'evaluation_failed';
    await recordErrorExecutionLog(db, {
      workspaceId: auth.workspace.id,
      logicId: logicRow.id,
      apiKeyId: auth.apiKey.id,
      requestedVersionType: 'production',
      requestedVersionNumber: null,
      errorCode: 'evaluation_failed',
      errorMessage: message.slice(0, 2000),
      latencyMs,
      requestId,
    });
    return { result: toolErrorResult('Evaluation failed unexpectedly.') };
  }

  const formattedTrace = formatTrace(versionEntry.data, trace);
  const latencyMs = Date.now() - startedAt;

  await recordExecutionLog(db, {
    workspaceId: auth.workspace.id,
    logicId: logicRow.id,
    apiKeyId: auth.apiKey.id,
    requestedVersionType: 'production',
    requestedVersionNumber: null,
    resolvedVersionNumber: versionEntry.versionNumber,
    versionId: logicRow.productionVersionId,
    inputs: coerced.inputs,
    status: engineStatus,
    outputs: outputsResponse,
    unmatchedTableName: unmatchedTable,
    formattedTrace,
    latencyMs,
    requestId,
  });

  const structuredContent =
    engineStatus === 'ok'
      ? {
          status: 'ok' as const,
          outputs: outputsResponse ?? {},
          trace: formattedTrace,
        }
      : {
          status: 'no_match' as const,
          unmatchedTable,
          trace: formattedTrace,
        };

  // Send the JSON twice: once as a `text` content block (for clients that
  // ignore structuredContent) and once as structuredContent (validated by the
  // outputSchema we publish in tools/list). Mirrors what the standalone server
  // returns.
  return {
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify(structuredContent, null, 2),
        },
      ],
      structuredContent,
      isError: false,
    },
  };
}

async function dispatch(
  db: Database,
  auth: AuthenticatedKey,
  req: JsonRpcRequest,
  requestId: string,
): Promise<JsonRpcResponse | null> {
  const id: JsonRpcId = req.id ?? null;

  if (isNotification(req)) {
    // Spec: notifications must not be replied to. We still want to accept
    // `notifications/initialized` (and anything else MCP clients send) so the
    // outer handler will return 204 / empty body in that case.
    return null;
  }

  switch (req.method) {
    case 'initialize': {
      const params =
        req.params && typeof req.params === 'object'
          ? (req.params as { protocolVersion?: unknown })
          : {};
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: pickProtocolVersion(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list': {
      const result = await handleToolsList(db, auth);
      return { jsonrpc: '2.0', id, result };
    }
    case 'tools/call': {
      const outcome = await handleToolsCall(db, auth, requestId, req.params);
      if ('error' in outcome) {
        return jsonRpcError(id, outcome.error.code, outcome.error.message);
      }
      return { jsonrpc: '2.0', id, result: outcome.result };
    }
    default:
      return jsonRpcError(
        id,
        JSON_RPC_METHOD_NOT_FOUND,
        `Method "${req.method}" is not supported by the LEVERIE hosted MCP server.`,
      );
  }
}

export const mcpRoutes = new Hono<{ Bindings: Env }>();

mcpRoutes.post('/v1/mcp', async (c) => {
  const requestIdHeader = c.req.header('x-request-id');
  const requestId =
    requestIdHeader &&
    requestIdHeader.length > 0 &&
    requestIdHeader.length <= 200
      ? requestIdHeader
      : crypto.randomUUID();

  const db = createDb(c.env.DATABASE_URL);

  const auth = await authenticateApiKey(
    db,
    c.env,
    c.req.header('authorization'),
  );
  if ('error' in auth) {
    // Return JSON-RPC-shaped errors even for auth failures so the entire
    // /v1/mcp surface is parsable by a single client codepath. HTTP status
    // still reflects the underlying failure so non-MCP tooling (curl, CI
    // assertions) can branch on status alone.
    return c.json(
      jsonRpcError(null, JSON_RPC_INVALID_REQUEST, auth.error.message, {
        code: auth.error.code,
      }),
      auth.error.status,
    );
  }

  const rateLimit = await enforceEvaluateRateLimit(c.env, auth.apiKey.id);
  if (!rateLimit.allowed) {
    return c.json(
      jsonRpcError(null, JSON_RPC_INVALID_REQUEST, 'Rate limit exceeded.', {
        code: 'rate_limited',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      }),
      429,
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  const raw = await c.req.json().catch(() => null);
  if (raw === null) {
    return c.json(
      jsonRpcError(null, JSON_RPC_PARSE_ERROR, 'Body is not valid JSON.'),
      400,
    );
  }

  // Batch support: spec § 6.0 says servers MAY support batched requests.
  // We accept arrays and process them sequentially (Workers + Neon HTTP makes
  // unbounded fan-out a footgun); a parallel-friendly path can land with P4.4.
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return c.json(
        jsonRpcError(null, JSON_RPC_INVALID_REQUEST, 'Empty batch.'),
        400,
      );
    }
    const responses: JsonRpcResponse[] = [];
    for (const entry of raw) {
      if (!isJsonRpcRequest(entry)) {
        responses.push(
          jsonRpcError(
            (entry as { id?: JsonRpcId } | null)?.id ?? null,
            JSON_RPC_INVALID_REQUEST,
            'Invalid JSON-RPC request shape.',
          ),
        );
        continue;
      }
      try {
        const result = await dispatch(db, auth, entry, requestId);
        if (result !== null) responses.push(result);
      } catch (err) {
        console.error('mcp dispatch error', err);
        responses.push(
          jsonRpcError(
            entry.id ?? null,
            JSON_RPC_INTERNAL_ERROR,
            'Internal server error.',
          ),
        );
      }
    }
    await touchApiKeyLastUsedAt(db, auth.apiKey.id);
    if (responses.length === 0) {
      // Pure-notification batch: spec says return nothing. Workers does not
      // allow 204 with a body, so use an empty 204.
      return c.body(null, 204);
    }
    return c.json(responses);
  }

  if (!isJsonRpcRequest(raw)) {
    return c.json(
      jsonRpcError(
        (raw as { id?: JsonRpcId } | null)?.id ?? null,
        JSON_RPC_INVALID_REQUEST,
        'Invalid JSON-RPC request shape.',
      ),
      400,
    );
  }

  let response: JsonRpcResponse | null;
  try {
    response = await dispatch(db, auth, raw, requestId);
  } catch (err) {
    console.error('mcp dispatch error', err);
    response = jsonRpcError(
      raw.id ?? null,
      JSON_RPC_INTERNAL_ERROR,
      'Internal server error.',
    );
  }

  await touchApiKeyLastUsedAt(db, auth.apiKey.id);

  if (response === null) {
    // Notification — no body, per JSON-RPC spec.
    return c.body(null, 204);
  }
  return c.json(response);
});
