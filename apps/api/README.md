# @leverie/api

LEVERIE Cloud API — Hono on Cloudflare Workers, backed by Neon Postgres via Drizzle, authentication by Better Auth.

**Surface**: `leverie.dev/api/*` (path-based, same origin as Editor / Runner UI). See [doc/design_p3_infrastructure.md §3.2](../../doc/design_p3_infrastructure.md) for the origin rationale.

**Status**: P3.2.f foundation. The full 12-table production schema ([design_p3_schema.md v7](../../doc/design_p3_schema.md)) is represented in Drizzle, the initial migration is self-contained, Better Auth is reconciled with the production `user` shape, the API origin decision is finalized as path-based `/api/*`, and GitHub Actions now run Drizzle migrations against local / preview / production database targets.

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
- `GET / POST /api/auth/*` — Better Auth router (sign-up / sign-in / OAuth / session / sign-out)
- `GET /api/me` — current session resolver (placeholder; P3.4 makes it tenant-aware)

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

Secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`) are set per-environment via:

```bash
wrangler secret put DATABASE_URL --env preview
wrangler secret put DATABASE_URL --env prod
# repeat for BETTER_AUTH_SECRET
```

Workers Routes (production `leverie.dev/api/*` → this Worker) are commented out in [wrangler.toml](./wrangler.toml) until the Cloudflare zone is wired up for deploy.

---

## Migration CI

[api-migrations.yml](../../.github/workflows/api-migrations.yml) owns the P3.2.f database workflow:

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

The following are wired in later sub-steps:

| Sub-step | Adds |
|---|---|
| **P3.3** | Google OAuth provider, Resend for magic links / invitation emails |
| **P3.4** | Org / workspace / membership CRUD, invitation flow, 5 roles |
| **P3.5** | Logic CRUD + versioning + publish |
| **P3.8〜P3.10** | Runner UI integration (read-only endpoints) |

---

## Notes on local Postgres

This scaffold reuses the docker-compose setup verified in [`spikes/p3-foundation/`](../../spikes/p3-foundation/) — Postgres 18 (volume at `/var/lib/postgresql` for the PG18 layout) + [local-neon-http-proxy](https://github.com/TimoWilhelm/local-neon-http-proxy) on :4444 so `@neondatabase/serverless` exercises the same Workers → HTTP → Postgres path as production.

When P3.2.a is stable, the spike can be archived to `spikes/_archive/` or deleted.
