# @leverie/api

LEVERIE Cloud API — Hono on Cloudflare Workers, backed by Neon Postgres via Drizzle, authentication by Better Auth.

**Surface**: `leverie.dev/api/*` (path-based, same origin as Editor / Runner UI). See [doc/design_p3_infrastructure.md §3.2](../../doc/design_p3_infrastructure.md) for the origin rationale.

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
- `GET /api/logics/:logicId/diff?from=production&to=draft` — diff `draft`, `production`, `latest`, or `vN`
- `GET /api/orgs/:orgId/members` — member list
- `PATCH / DELETE /api/orgs/:orgId/members/:membershipId` — member management
- `GET / POST /api/orgs/:orgId/invitations` — invitation list / create
- `POST /api/orgs/:orgId/invitations/:invitationId/revoke` — revoke pending invitation
- `GET / POST /api/invitations/accept` — accept invitation with a token

---

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | `wrangler dev` — local Worker on :8787 |
| `pnpm build` | `wrangler deploy --dry-run --outdir=dist` — bundle size + type check via wrangler |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm deploy:preview` | deploy to `leverie-api-preview` Worker (preview env) |
| `pnpm deploy:prod` | deploy to `leverie-api-prod` Worker (prod env) |
| `pnpm db:up` / `db:down` | start / stop local docker-compose (Postgres 18 + Neon proxy) |
| `pnpm db:push` | apply schema directly (dev only; prefer `db:migrate` when validating migrations) |
| `pnpm db:generate` | generate a new migration from schema diff |
| `pnpm db:migrate` | apply pending migrations |
| `pnpm db:psql` | open psql against local Postgres |
| `pnpm smoke:origin` | compare same-origin `/api/*` and cross-origin fallback CORS / cookie behavior against a running local Worker |

---

## Environment matrix

| Env | Worker name | Hostname | Postgres |
|---|---|---|---|
| local | (no name) | `localhost:8787` | docker-compose Postgres + Neon proxy |
| preview | `leverie-api-preview` | `preview.leverie.dev` | Neon preview branch |
| prod | `leverie-api-prod` | `leverie.dev` | Neon main branch |

`CORS_ALLOWED_ORIGINS` is intentionally empty in preview / prod because the
primary API shape is same-origin `leverie.dev/api/*`. Set it only when exercising
the `api.leverie.dev` fallback, as a comma-separated list of SPA origins allowed
to send credentialed requests.

Secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`) are set per-environment via:

```bash
wrangler secret put DATABASE_URL --env preview
wrangler secret put DATABASE_URL --env prod
# repeat for BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# and RESEND_API_KEY when email delivery is enabled
```

Workers Routes (production `leverie.dev/api/*` → this Worker) are commented out in [wrangler.toml](./wrangler.toml) until the Cloudflare zone is wired up for deploy.

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

## Tenant API Smoke Flow

The examples below assume a running local Worker and use cookie jars so Better
Auth session cookies round-trip correctly.

```bash
BASE="http://localhost:8787"
OWNER_COOKIE="/tmp/leverie-owner-cookie.txt"
AUTHOR_COOKIE="/tmp/leverie-author-cookie.txt"

# 1) Sign up the owner.
curl -fsS -c "$OWNER_COOKIE" "$BASE/api/auth/sign-up/email" \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.test","password":"password123456","name":"Owner"}'

# 2) Create an org. This also creates owner membership and a default workspace.
curl -fsS -b "$OWNER_COOKIE" "$BASE/api/orgs" \
  -H 'content-type: application/json' \
  -d '{"name":"Acme Ops","slug":"acme-ops"}'

# 3) List org memberships for the signed-in owner.
curl -fsS -b "$OWNER_COOKIE" "$BASE/api/me"
```

Use the `org.id` returned by step 2:

```bash
ORG_ID="paste-org-id"

# 4) Create another workspace.
curl -fsS -b "$OWNER_COOKIE" "$BASE/api/orgs/$ORG_ID/workspaces" \
  -H 'content-type: application/json' \
  -d '{"name":"Claims Review","slug":"claims-review"}'

# 5) Invite an Author. With RESEND_API_KEY configured, Resend sends the email.
#    The response also includes acceptUrl to keep local smoke testing simple.
curl -fsS -b "$OWNER_COOKIE" "$BASE/api/orgs/$ORG_ID/invitations" \
  -H 'content-type: application/json' \
  -d '{"email":"author@example.test","role":"editor"}'
```

Sign up or sign in as the invited user, then accept the invitation token from
the returned `acceptUrl` or the delivered email:

```bash
curl -fsS -c "$AUTHOR_COOKIE" "$BASE/api/auth/sign-up/email" \
  -H 'content-type: application/json' \
  -d '{"email":"author@example.test","password":"password123456","name":"Author"}'

TOKEN="paste-token-from-accept-url"
curl -fsS -b "$AUTHOR_COOKIE" "$BASE/api/invitations/accept" \
  -H 'content-type: application/json' \
  -d "{\"token\":\"$TOKEN\"}"
```

Role rules in this slice:

- `owner` and `admin` can manage members and invitations.
- Only `owner` can invite or grant another `owner`.
- `editor` and higher can create or update workspaces.
- `owner` can request org deletion; this soft-deletes the org and queues an
  `org_deletion_job` for the later purge worker.
- Removing or demoting the last active `owner` is rejected.

---

## Migration CI

[api-migrations.yml](../../.github/workflows/api-migrations.yml) owns the database migration workflow:

| Trigger | What runs |
|---|---|
| PR opened / updated | local Postgres 18 migration validation, API typecheck, Worker dry-run build |
| Internal PR opened / updated | create or reuse Neon branch `gh-pr-<number>`, then run `pnpm db:migrate` against it |
| PR closed | delete Neon branch `gh-pr-<number>` |
| push to `main` | run `pnpm db:migrate` against production Neon |
| manual dispatch | run migrations against shared preview or production |

Required GitHub configuration:

| Type | Name | Used for |
|---|---|---|
| variable | `NEON_PROJECT_ID` | Neon branch actions |
| variable | `NEON_PREVIEW_PARENT_BRANCH` | parent branch for PR preview DBs, defaults to `main` |
| variable | `NEON_PREVIEW_DATABASE` | Neon database name, defaults to `neondb` |
| variable | `NEON_PREVIEW_ROLE` | migration role, defaults to `neondb_owner` |
| secret | `NEON_API_KEY` | create / delete preview branches |
| secret | `NEON_PREVIEW_DATABASE_URL` | manual shared-preview migration |
| secret | `NEON_PROD_DATABASE_URL` | production migration |

---

## What this scaffold does NOT yet include

Runner UI integration is still wired later, including the read-only endpoint
shape used by stakeholder review and shared runner links.

---

## Notes on local Postgres

This scaffold reuses the docker-compose setup verified in [`spikes/p3-foundation/`](../../spikes/p3-foundation/) — Postgres 18 (volume at `/var/lib/postgresql` for the PG18 layout) + [local-neon-http-proxy](https://github.com/TimoWilhelm/local-neon-http-proxy) on :4444 so `@neondatabase/serverless` exercises the same Workers → HTTP → Postgres path as production.

When the API foundation is stable, the spike can be archived to
`spikes/_archive/` or deleted.
