# @leverie/api

LEVERIE Cloud API — Hono on Cloudflare Workers, backed by Neon Postgres via Drizzle, authentication by Better Auth.

**Surface**:

- `leverie.dev/api/*` — browser surface (cookie session via Better Auth, CSRF gate, credentialed CORS). Used by Editor and Runner UI.
- `leverie.dev/v1/*` — external Bearer-authenticated API for LLM agents, MCP bridges, and customer integrations. Permissive CORS, no cookies.

Both share the same Worker but diverge on middleware. See [doc/design_p3_infrastructure.md §3.2](../../doc/design_p3_infrastructure.md) for the origin rationale and [apps/api/src/index.ts](./src/index.ts) for the middleware stack.

**Status**: Cloud foundation in progress. The full 12-table production schema ([design_p3_schema.md v7](../../doc/design_p3_schema.md)) is represented in Drizzle, the initial migration is self-contained, Better Auth is reconciled with the production `user` shape, the API origin decision is finalized as path-based `/api/*`, GitHub Actions run Drizzle migrations against local / preview / production database targets, Better Auth has email/password, magic-link, Google OAuth, and Resend delivery wiring, and the tenant + logic CRUD/versioning APIs are available.

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
