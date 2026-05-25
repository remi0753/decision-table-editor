# @leverie/api

LEVERIE Cloud API — Hono on Cloudflare Workers, backed by Neon Postgres via Drizzle, authentication by Better Auth.

**Surface**:

- `leverie.dev/api/*` — browser surface (cookie session via Better Auth, CSRF gate, credentialed CORS). Used by Editor and Runner UI.
- `leverie.dev/v1/*` — external Bearer-authenticated API for LLM agents and customer integrations. Permissive CORS, no cookies. Two surfaces: the REST [Evaluate API](#evaluate-api-v1) (`POST /v1/logics/:id/evaluate`) and the [Hosted MCP](#hosted-mcp-v1mcp) (`POST /v1/mcp`, JSON-RPC 2.0).

Both share the same Worker but diverge on middleware. See [doc/design_p3_infrastructure.md §3.2](../../doc/design_p3_infrastructure.md) for the origin rationale and [apps/api/src/index.ts](./src/index.ts) for the middleware stack.

**Status**: Cloud foundation in progress. The full 12-table production schema ([design_p3_schema.md v7](../../doc/design_p3_schema.md)) is represented in Drizzle, the initial migration is self-contained, Better Auth is reconciled with the production `user` shape, the API origin decision is finalized as path-based `/api/*`, GitHub Actions run Drizzle migrations against local / preview / production database targets, Better Auth has email/password, magic-link, Google OAuth, and Resend delivery wiring, the tenant + logic CRUD/versioning APIs are available, and both external `/v1/*` surfaces are live — REST [Evaluate API](#evaluate-api-v1) (P4.2) and JSON-RPC [Hosted MCP](#hosted-mcp-v1mcp) (P4.3 + P4.4).

---

## Local setup

```bash
cd apps/api

# 1) install (workspace member, runs from monorepo root once is fine too)
pnpm install

# 2) local env
cp .dev.vars.example .dev.vars
# edit BETTER_AUTH_SECRET to a real random value:
#   openssl rand -base64 32
# for Google OAuth / Resend, see "Local Google OAuth setup" below

# 3) Postgres 18 + Neon HTTP proxy
pnpm db:up

# 4) apply the initial migration
pnpm db:migrate

# 5) start the worker
pnpm dev
```

Worker listens on `http://localhost:8787`. Endpoints:

- `GET /` — liveness ping
- `GET /healthz` — DB-roundtrip health check
- `GET / POST /api/auth/*` — Better Auth router (sign-up / sign-in / magic link / OAuth / session / sign-out)
- `GET /api/me` — current session plus org memberships
- `GET / POST /api/orgs` — org list / create
- `PATCH / DELETE /api/orgs/:orgId` — org metadata update / deletion request
- `GET / POST /api/orgs/:orgId/workspaces` — workspace list / create
- `PATCH / DELETE /api/workspaces/:workspaceId` — workspace update / soft delete
- `GET / POST /api/workspaces/:workspaceId/logics` — logic list / create
- `GET / PATCH / DELETE /api/logics/:logicId` — logic get / draft or metadata update / soft delete
- `GET /api/logics/:logicId/versions` — published version list
- `GET /api/logics/:logicId/versions/:versionNumber` — published version get
- `POST /api/logics/:logicId/publish` — publish draft snapshot, optionally pinning production
- `POST /api/logics/:logicId/production` — pin production to an existing published version
- `POST /api/logics/:logicId/runner-share` — create/copy a fixed Runner URL and optionally invite a viewer/runner to it
- `GET /api/logics/:logicId/diff?from=production&to=draft` — diff `draft`, `production`, `latest`, or `vN`
- `GET /api/orgs/:orgId/members` — member list
- `PATCH / DELETE /api/orgs/:orgId/members/:membershipId` — member management
- `GET / POST /api/orgs/:orgId/invitations` — invitation list / create
- `POST /api/orgs/:orgId/invitations/:invitationId/revoke` — revoke pending invitation
- `GET /api/invitations/preview` — validate an invitation token and return org/email hints for onboarding
- `GET / POST /api/invitations/accept` — accept invitation with a token
- `GET / POST /api/workspaces/:workspaceId/api-keys` — API key list / create (owner/admin only; secret returned once)
- `PATCH /api/api-keys/:apiKeyId` — rename, change role, or update allow-list
- `POST /api/api-keys/:apiKeyId/revoke` — revoke an API key
- `POST /v1/logics/:logicId/evaluate` — **external** Bearer-authenticated evaluate ([Evaluate API](#evaluate-api-v1) below)
- `POST /v1/mcp` — **external** Bearer-authenticated MCP server, JSON-RPC 2.0 over HTTP ([Hosted MCP](#hosted-mcp-v1mcp) below)

---

## Scripts

| Script                   | What it does                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`               | `wrangler dev` — local Worker on :8787                                                                       |
| `pnpm build`             | `wrangler deploy --dry-run --outdir=dist` — bundle size + type check via wrangler                            |
| `pnpm typecheck`         | `tsc --noEmit`                                                                                               |
| `pnpm deploy:preview`    | deploy to `leverie-api-preview` Worker (preview env)                                                         |
| `pnpm deploy:prod`       | deploy to `leverie-api-prod` Worker (prod env)                                                               |
| `pnpm db:up` / `db:down` | start / stop local docker-compose (Postgres 18 + Neon proxy)                                                 |
| `pnpm db:push`           | apply schema directly (dev only; prefer `db:migrate` when validating migrations)                             |
| `pnpm db:generate`       | generate a new migration from schema diff                                                                    |
| `pnpm db:migrate`        | apply pending migrations                                                                                     |
| `pnpm db:psql`           | open psql against local Postgres                                                                             |
| `pnpm smoke:origin`      | compare same-origin `/api/*` and cross-origin fallback CORS / cookie behavior against a running local Worker |

---

## Environment matrix

| Env     | Worker name           | Hostname              | Postgres                             |
| ------- | --------------------- | --------------------- | ------------------------------------ |
| local   | (no name)             | `localhost:8787`      | docker-compose Postgres + Neon proxy |
| preview | `leverie-api-preview` | `preview.leverie.dev` | Neon preview branch                  |
| prod    | `leverie-api-prod`    | `leverie.dev`         | Neon main branch                     |

`CORS_ALLOWED_ORIGINS` is intentionally empty in preview / prod because the
primary API shape is same-origin `leverie.dev/api/*`. Set it only when exercising
the `api.leverie.dev` fallback, as a comma-separated list of SPA origins allowed
to send credentialed requests.

Secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `HMAC_KEY_RING_JSON`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`) are set
per-environment via:

```bash
wrangler secret put DATABASE_URL --env preview
wrangler secret put DATABASE_URL --env prod
# repeat for BETTER_AUTH_SECRET, HMAC_KEY_RING_JSON, GOOGLE_CLIENT_ID,
# GOOGLE_CLIENT_SECRET, and RESEND_API_KEY when email delivery is enabled
```

Workers Routes are declared per environment in [wrangler.toml](./wrangler.toml):
`preview.leverie.dev/{api,v1}/*` for preview, `leverie.dev/{api,v1}/*` for prod.
Both prefixes route to the same Worker; the middleware stack in [src/index.ts](./src/index.ts)
diverges per prefix (`/api/*` = cookie + CSRF + credentialed CORS, `/v1/*` = Bearer + permissive CORS).

---

## Auth Providers

The API currently enables:

- Email/password sign-up and sign-in.
- Magic-link sign-in through Better Auth's magic-link plugin.
- Google OAuth when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present.
- Resend-backed email delivery when `RESEND_API_KEY` is present. Without a
  Resend key, local magic links are printed to the Wrangler console.

Useful auth endpoints while testing:

```bash
# Start Google OAuth. The response includes a Google redirect URL.
curl -i http://localhost:8787/api/auth/sign-in/social \
  -H 'content-type: application/json' \
  -d '{"provider":"google","callbackURL":"http://localhost:5173/"}'

# Send a magic link. With no RESEND_API_KEY, watch the Wrangler console.
curl -i http://localhost:8787/api/auth/sign-in/magic-link \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","callbackURL":"http://localhost:5173/"}'
```

### Local Google OAuth setup

Google OAuth can be tested against the local Worker without tunneling.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or
   create a development project.
2. Configure the OAuth consent screen / branding page. For local development,
   use "External" in testing mode unless the project belongs to a Google
   Workspace organization. Add your own Google account as a test user if the app
   is in testing mode.
3. Create an OAuth client with application type **Web application**.
4. Add this authorized redirect URI exactly:

```text
http://localhost:8787/api/auth/callback/google
```

5. Copy the generated client ID and client secret into `apps/api/.dev.vars`:

```bash
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

6. Keep `BETTER_AUTH_URL="http://localhost:8787"` for local Worker testing.
   Better Auth builds the Google callback URL from this base URL.
7. Start local dependencies and the Worker:

```bash
pnpm db:up
pnpm db:migrate
pnpm dev
```

8. Trigger OAuth from the frontend or by posting to
   `http://localhost:8787/api/auth/sign-in/social` with provider `google`.

If Google returns `redirect_uri_mismatch`, compare the URI shown in Google's
error details with the exact URI above. The scheme, hostname, port, and path
must match the registered redirect URI.

For production, register the production callback separately:

```text
https://leverie.dev/api/auth/callback/google
```

References: [Google OAuth client management](https://support.google.com/cloud/answer/6158849?hl=en)
and [Google OAuth for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server).

---

## Evaluate API (`/v1`)

External surface for LLM agents, MCP bridges, and customer integrations. Authenticated with workspace-scoped API keys issued from the org settings UI (P4.1). Implementation: [src/routes/evaluate.ts](./src/routes/evaluate.ts).

### Endpoint

```
POST /v1/logics/:logicId/evaluate
```

### Headers

| Header          | Required | Description                                                                                                                                     |
| --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authorization` | yes      | `Bearer lvr_<base64url>` — the API key secret returned once when the key was created                                                            |
| `Content-Type`  | yes      | `application/json`                                                                                                                              |
| `X-Request-Id`  | no       | Caller-supplied correlation id, max 200 chars. Stored on `execution_log.request_id` and echoed in the response. Auto-generated UUID when absent |

### Query parameters

| Param     | Default      | Allowed                                           | Notes                                                                                                                                      |
| --------- | ------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `version` | `production` | `production`, `latest`, `v<N>` (positive integer) | `draft` is **rejected** (400 `invalid_version`) — drafts are mutable and unsnapshot'd, which breaks the execution_log / audit replay model |

### Request body

Minimal shape — exactly one required field, `inputs`. Versioning, auth, and correlation live in the URL / headers so the body stays a clean record of evaluation inputs (and so future expansion does not pollute `execution_log.inputs`).

```json
{
  "inputs": {
    "Customer Type": "Corp",
    "Amount": 5500000,
    "Has Guarantor": true
  }
}
```

| Field          | Type                        | Rules                                                                                                                                                                                                                                                                      |
| -------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputs`       | object                      | **Required.** Object (not array, not null). Missing → 400 `invalid_inputs`                                                                                                                                                                                                 |
| `inputs.<key>` | string \| number \| boolean | Keys can be field **names** (e.g. `"Customer Type"`) or internal **field ids** (e.g. `"f1"`); the engine resolves either via `normaliseInputKeys`. Numbers and booleans are coerced to string before evaluation (the engine then re-coerces per the field's declared type) |

**Limits**:

- Request body ≤ 1 MB (enforced by `/v1/*` body limit)
- `inputs` ≤ 200 keys
- Each `inputs` value ≤ 4000 chars (post-stringification)
- `null` / `undefined` / arrays / nested objects in `inputs` are silently dropped — these would have failed evaluation anyway, and dropping keeps the surface forgiving for partial inputs

### Response — 200 OK (matched)

```json
{
  "logic": { "id": "...", "slug": "approval", "name": "Approval" },
  "version": { "id": "...", "versionNumber": 2, "requestedType": "production" },
  "result": { "status": "ok", "outputs": { "Decision": "approve" } },
  "trace": [
    {
      "table": "Main",
      "depth": 0,
      "matchedRow": { "index": 1, "conclusion": "terminal" },
      "skippedRows": []
    }
  ],
  "requestId": "...",
  "latencyMs": 12
}
```

`outputs` is keyed by output **column name** (matching what `@leverie/schema`'s `logicToOutputSchema` advertises). `trace` uses 1-based row indices and field names — no internal IDs leak.

### Response — 200 OK (no rule matched)

```json
{
  "logic":    { ... },
  "version":  { ... },
  "result":   { "status": "no_match", "unmatchedTable": "Main" },
  "trace":    [ ... ],
  "requestId": "...",
  "latencyMs": 7
}
```

The HTTP status stays 200 because the call itself succeeded — it's the _logic_ that produced no match. `unmatchedTable` is the **name** of the table at which evaluation stopped.

### Errors

| HTTP | Code                          | Cause                                                                                                                   |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 400  | `invalid_inputs`              | Body missing `inputs`, or `inputs` is not an object, or a value exceeds 4000 chars                                      |
| 400  | `invalid_version`             | `?version=` is neither `production`, `latest`, nor `v<N>`                                                               |
| 401  | `missing_authorization`       | `Authorization` header absent                                                                                           |
| 401  | `invalid_authorization`       | Header is not `Bearer <token>`                                                                                          |
| 401  | `invalid_api_key`             | Token does not match any active API key (HMAC lookup miss, or scrypt verify failed)                                     |
| 401  | `api_key_revoked`             | Key was revoked via `POST /api/api-keys/:id/revoke`                                                                     |
| 401  | `api_key_expired`             | Key's `expiresAt` has passed                                                                                            |
| 401  | `api_key_secret_unconfigured` | Server is missing `HMAC_KEY_RING_JSON` — operational misconfiguration                                                   |
| 403  | `logic_not_in_scope`          | API key is in `allowlist` mode and the requested logic is not in its `api_key_logic_scope`                              |
| 404  | `not_found`                   | Logic does not exist in the API key's workspace                                                                         |
| 404  | `no_published_version`        | The requested version (`production` not pinned, `latest` with zero versions, or non-existent `v<N>`) cannot be resolved |
| 413  | `payload_too_large`           | Request body > 1 MB                                                                                                     |
| 429  | `rate_limited`                | Per-key rate limit tripped; response includes `Retry-After` header and `retryAfterSeconds` field                        |
| 500  | `evaluation_failed`           | Engine threw — `error_message` (truncated to 2000 chars) is persisted to `execution_log`                                |

All error responses share the shape `{ "error": { "code": "...", "message": "..." } }`. The `rate_limited` body additionally carries `retryAfterSeconds`.

### Rate limits

Per-key fixed window (Cloudflare KV / Redis backed via `secondaryStorage`):

| Window | Limit        |
| ------ | ------------ |
| 10 s   | 60 requests  |
| 60 s   | 600 requests |

Both must pass; the stricter one trips first under sustained load. Tighter or per-plan tiers land with P6 billing.

### Persistence

Every call writes one row to `execution_log` regardless of outcome:

| Status     | Filled columns                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `ok`       | `inputs`, `result` (= `{status:"ok", outputs}`), `trace`, `logic_version_id`, `resolved_version_number`              |
| `no_match` | `inputs`, `result` (= `{status:"no_match", unmatchedTable}`), `trace`, `logic_version_id`, `resolved_version_number` |
| `error`    | `error_code`, `error_message`; `result` / `trace` left NULL (per `execution_log_status_payload_chk`)                 |

Common columns: `caller_actor_type='api_key'`, `caller_channel='api_key'`, `caller_api_key_id`, `request_id`, `latency_ms`. `api_key.last_used_at` is best-effort bumped on every successful authentication.

### Curl example

```bash
# 1) Create an API key (browser session via /api/* — see Tenant API Smoke Flow).
SECRET=$(curl -fsS -b "$OWNER_COOKIE" \
  "$BASE/api/workspaces/$WORKSPACE_ID/api-keys" \
  -H 'content-type: application/json' \
  -d '{"name":"Production MCP","role":"viewer","scopeMode":"all"}' \
  | jq -r '.secret')

# 2) Evaluate the production version of a logic.
curl -fsS "$BASE/v1/logics/$LOGIC_ID/evaluate?version=production" \
  -H "authorization: Bearer $SECRET" \
  -H 'content-type: application/json' \
  -d '{"inputs":{"Customer Type":"Corp","Amount":5500000,"Has Guarantor":true}}'

# 3) Pin a specific version.
curl -fsS "$BASE/v1/logics/$LOGIC_ID/evaluate?version=v3" \
  -H "authorization: Bearer $SECRET" \
  -H 'content-type: application/json' \
  -H 'x-request-id: nightly-backfill-2026-05-24-batch-001' \
  -d '{"inputs":{"Amount":50}}'
```

---

## Hosted MCP (`/v1/mcp`)

Hosted MCP lets LLM agents connect with an API key and call every published logic the key can reach as an MCP tool, with input / output JSON Schemas derived from `@leverie/schema`.

Implementation: [src/routes/mcp.ts](./src/routes/mcp.ts).

### Hosted MCP model

Hosted MCP uses the cloud data plane and production publishing model:

| Aspect             | Hosted (`POST /v1/mcp`)                          |
| ------------------ | ------------------------------------------------ |
| Transport          | HTTP POST (JSON-RPC 2.0, stateless)              |
| Data source        | Postgres — published `logic_version` snapshots   |
| Auth               | Bearer API key (`Authorization: Bearer lvr_...`) |
| Tool catalog       | `tools/list` shows every in-scope logic with a pinned production version |
| Tool freshness     | Always served from the current production pin    |
| Editor integration | Editor saves → publish → tool catalog updates    |

### Endpoint

```
POST /v1/mcp
```

Single endpoint for all JSON-RPC methods. Stateless — the server holds no session between requests, so every request reissues authentication and (when needed) `initialize`. This trades the streamable-HTTP transport's bidirectional channel away in exchange for Workers-friendly statelessness. Clients that need session affinity should reissue `initialize` per request or use a bridge process that keeps client-side session state.

### Headers

| Header          | Required | Description                                                                                   |
| --------------- | -------- | --------------------------------------------------------------------------------------------- |
| `Authorization` | yes      | `Bearer lvr_<base64url>` — same key shape and auth path as the Evaluate API                   |
| `Content-Type`  | yes      | `application/json`                                                                            |
| `X-Request-Id`  | no       | Correlation id used on every `execution_log` row written by `tools/call`; auto-generated UUID when absent |

### Supported methods

| Method                     | Result                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `initialize`               | `{ protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "leverie-mcp-hosted", version } }`. Client-supplied `protocolVersion` is echoed if supported (`2024-11-05`, `2025-03-26`, `2025-06-18`), otherwise the latest is returned |
| `ping`                     | Empty object — health probe used by some MCP clients                                                                                     |
| `tools/list`               | `{ tools: [...] }`. One tool per logic in scope with a pinned production version. Tools without production are intentionally hidden so the LLM's catalog never contains entries that would only error on call |
| `tools/call`               | `{ content: [{type:"text", text:"<json>"}], structuredContent: {...}, isError: false }`. Evaluates the named tool against its production snapshot |
| `notifications/*`          | Accepted and acknowledged with HTTP 204 (no JSON-RPC response body, per spec)                                                            |

Unknown methods return JSON-RPC error `-32601` (`method_not_found`).

### Tool definitions

`tools/list` emits one tool definition per accessible logic:

| Field          | Source                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `logic.slug` (workspace-unique, slug-shaped, stable across renames of `logic.name`)                                                   |
| `description`  | `logicToToolDescription(logic)` from `@leverie/schema` (machine-readable Inputs / Outputs summary), with `Version: v<N> (production).` appended |
| `inputSchema`  | `logicToInputSchema(logic)` — JSON Schema draft 2020-12, `additionalProperties: false`, keyed by **field name**                       |
| `outputSchema` | `logicToOutputSchema(logic)` — `oneOf` of `{status:"ok", outputs, trace}` and `{status:"no_match", unmatchedTable, trace}`            |

### tools/call contract

Tool execution failures (invalid inputs, engine errors) come back as a normal JSON-RPC `result` with `isError: true` and an explanatory `content` block, per the MCP spec. Reserve JSON-RPC errors for protocol-level problems:

| JSON-RPC error code | When                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `-32600`            | Auth failed, rate limited, malformed request, or invalid JSON-RPC envelope                        |
| `-32601`            | Unsupported method (only `initialize`, `ping`, `tools/list`, `tools/call`, `notifications/*` are recognized) |
| `-32602`            | Unknown tool name, malformed `tools/call` params, or tool whose production snapshot can no longer be loaded |
| `-32603`            | Internal server error (handler threw)                                                             |
| `-32700`            | Body is not valid JSON                                                                            |

Version selection is **always production** for hosted MCP — the same reason `?version=draft` is rejected by the Evaluate API: drafts are mutable and inconsistent during editing, which breaks the `execution_log` audit / replay model.

### Persistence

Every successful `tools/call` writes one `execution_log` row with the same shape as the Evaluate API (`caller_actor_type='api_key'`, `caller_channel='api_key'`, `requested_version_type='production'`). Unknown-tool rejections and other protocol-level errors do **not** write `execution_log` rows — they never reached evaluation. `api_key.last_used_at` is best-effort bumped on every authenticated request.

### Rate limits

Per-key fixed window, **shared with the Evaluate API** (one key, one bucket, regardless of which `/v1/*` surface is used):

| Window | Limit        |
| ------ | ------------ |
| 10 s   | 60 requests  |
| 60 s   | 600 requests |

Trips return JSON-RPC error `-32600` with `data: { code: "rate_limited", retryAfterSeconds }` plus a `Retry-After` HTTP header.

### Curl examples

```bash
# 1) initialize — most MCP SDKs send this once at session start.
curl -fsS "$BASE/v1/mcp" \
  -H "authorization: Bearer $SECRET" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'

# 2) tools/list — see every logic this API key can call.
curl -fsS "$BASE/v1/mcp" \
  -H "authorization: Bearer $SECRET" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3) tools/call — evaluate the production snapshot. Tool name is logic.slug.
curl -fsS "$BASE/v1/mcp" \
  -H "authorization: Bearer $SECRET" \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"approval",
      "arguments":{"Customer Type":"Corp","Amount":5500000,"Has Guarantor":true}
    }
  }'
```

### Connecting from MCP clients

Most stdio-only MCP clients (Claude Desktop, Cursor, Cline) cannot speak this transport directly. Two patterns work today:

1. **Direct HTTP MCP**: clients that support HTTP MCP transports (or which can wrap a custom transport) can POST directly to `/v1/mcp`. The wire format is plain JSON-RPC 2.0 — the curl examples above are the entire protocol.
2. **Bridge process**: stdio-only clients can run a small bridge that accepts local MCP messages and forwards them to `/v1/mcp` with an API key.

A native streamable-HTTP transport for hosted MCP is intentionally deferred — P4.5 ships a TypeScript SDK that wraps `/v1/mcp` for the most common consumption path, and P4.6 publishes an OpenAPI doc covering both `/v1` surfaces.

---

## Migration CI

[api-migrations.yml](../../.github/workflows/api-migrations.yml) owns the database migration workflow:

| Trigger                      | What runs                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| PR opened / updated          | local Postgres 18 migration validation, API typecheck, Worker dry-run build         |
| Internal PR opened / updated | create or reuse Neon branch `gh-pr-<number>`, then run `pnpm db:migrate` against it |
| PR closed                    | delete Neon branch `gh-pr-<number>`                                                 |
| push to `main`               | run `pnpm db:migrate` against production Neon                                       |
| manual dispatch              | run migrations against shared preview or production                                 |

Required GitHub configuration:

| Type     | Name                         | Used for                                             |
| -------- | ---------------------------- | ---------------------------------------------------- |
| variable | `NEON_PROJECT_ID`            | Neon branch actions                                  |
| variable | `NEON_PREVIEW_PARENT_BRANCH` | parent branch for PR preview DBs, defaults to `main` |
| variable | `NEON_PREVIEW_DATABASE`      | Neon database name, defaults to `neondb`             |
| variable | `NEON_PREVIEW_ROLE`          | migration role, defaults to `neondb_owner`           |
| secret   | `NEON_API_KEY`               | create / delete preview branches                     |
| secret   | `NEON_PREVIEW_DATABASE_URL`  | manual shared-preview migration                      |
| secret   | `NEON_PROD_DATABASE_URL`     | production migration                                 |

---

## What this scaffold does NOT yet include

Runner UI integration is still wired later, including the read-only endpoint
shape used by stakeholder review and shared runner links.

---

## Notes on local Postgres

This scaffold reuses the docker-compose setup verified in [`spikes/p3-foundation/`](../../spikes/p3-foundation/) — Postgres 18 (volume at `/var/lib/postgresql` for the PG18 layout) + [local-neon-http-proxy](https://github.com/TimoWilhelm/local-neon-http-proxy) on :4444 so `@neondatabase/serverless` exercises the same Workers → HTTP → Postgres path as production.

When the API foundation is stable, the spike can be archived to
`spikes/_archive/` or deleted.
