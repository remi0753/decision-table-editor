# @leverie/api

LEVERIE Cloud API — Hono on Cloudflare Workers, backed by Neon Postgres via Drizzle, authentication by Better Auth.

**Surface**:

- `leverie.dev/api/*` — browser surface (cookie session via Better Auth, CSRF gate, credentialed CORS). Used by Editor and Runner UI.
- `leverie.dev/v1/*` — external Bearer-authenticated API for LLM agents and customer integrations. Permissive CORS, no cookies. Two surfaces: the REST [Evaluate API](../../packages/server/README.md#evaluate-api-v1) (`POST /v1/logics/:id/evaluate`) and the [Hosted MCP](../../packages/server/README.md#hosted-mcp-v1mcp) (`POST /v1/mcp`, JSON-RPC 2.0).

Both share the same Worker but diverge on middleware. See [doc/design_infrastructure.md → URL and Origin Policy](../../doc/design_infrastructure.md#url-and-origin-policy) for the origin rationale and [apps/api/src/index.ts](./src/index.ts) for the middleware stack.

API specs (auth providers, `/v1/logics/:id/evaluate`, `/v1/mcp`) live in [packages/server/README.md](../../packages/server/README.md) since both the cloud Worker and the self-hosted `@leverie/server` expose the same surface.

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
# for Google OAuth / Resend, see "Local Google OAuth setup" in
# packages/server/README.md

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
- `POST /v1/logics/:logicId/evaluate` — **external** Bearer-authenticated evaluate ([Evaluate API](../../packages/server/README.md#evaluate-api-v1))
- `POST /v1/mcp` — **external** Bearer-authenticated MCP server, JSON-RPC 2.0 over HTTP ([Hosted MCP](../../packages/server/README.md#hosted-mcp-v1mcp))

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

## Migration CI

`.github/workflows/api-migrations.yml` owns the database migration workflow:

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

## Notes on local Postgres

The local [`docker-compose.yml`](./docker-compose.yml) provides Postgres 18 (volume at `/var/lib/postgresql` for the PG18 layout) + [local-neon-http-proxy](https://github.com/TimoWilhelm/local-neon-http-proxy) on :4444 so `@neondatabase/serverless` exercises the same Workers → HTTP → Postgres path as production.
