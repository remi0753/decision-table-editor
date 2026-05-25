import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { createAuth } from './auth.js';
import { createDb } from './db/client.js';
import { user as userTable } from './db/schema.js';
import type { Env } from './env.js';
import { buildOpenApiDocument } from './openapi.js';
import { getAllowedOrigins, resolveCorsOrigin } from './origins.js';
import { apiKeyRoutes } from './routes/apiKeys.js';
import { evaluateRoutes } from './routes/evaluate.js';
import { logicRoutes } from './routes/logics.js';
import { mcpRoutes } from './routes/mcp.js';
import { orgRoutes } from './routes/orgs.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { resolveSecondaryStorage } from './secondaryStorage.js';

export const app = new Hono<{ Bindings: Env }>();

// 1 MB ceiling on request bodies under /api/*. The largest legitimate payload
// is a logic draft (jsonb), and the editor caps real-world drafts well under
// this. Without the limit, an attacker can OOM a Worker isolate by streaming
// hundreds of megabytes into c.req.json().
const API_MAX_BODY_BYTES = 1024 * 1024;
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isJsonContentType(value: string | null) {
  if (!value) return false;
  return value.toLowerCase().split(';', 1)[0]?.trim() === 'application/json';
}

function hasRequestBody(request: Request) {
  return (
    request.body !== null ||
    request.headers.has('content-length') ||
    request.headers.has('transfer-encoding')
  );
}

const apiBodyLimit = bodyLimit({
  maxSize: API_MAX_BODY_BYTES,
  onError: (c) =>
    c.json(
      {
        error: {
          code: 'payload_too_large',
          message: 'Request body exceeds 1 MB limit.',
        },
      },
      413,
    ),
});

app.use('/api/*', apiBodyLimit);
// /v1/* is the Bearer-authenticated external API; it shares the same byte
// ceiling but skips the cookie-based CSRF gate that follows.
app.use('/v1/*', apiBodyLimit);

app.use('/api/*', async (c, next) => {
  if (!UNSAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const origin = c.req.header('origin');
  const fetchSite = c.req.header('sec-fetch-site');
  if (
    fetchSite === 'cross-site' ||
    (origin && !resolveCorsOrigin(origin, c.env))
  ) {
    return c.json(
      {
        error: {
          code: 'csrf_rejected',
          message: 'Cross-site state-changing requests are not allowed.',
        },
      },
      403,
    );
  }

  if (
    hasRequestBody(c.req.raw) &&
    !isJsonContentType(c.req.header('content-type') ?? null)
  ) {
    return c.json(
      {
        error: {
          code: 'unsupported_media_type',
          message: 'State-changing API requests must use application/json.',
        },
      },
      415,
    );
  }

  await next();
});

// Path-based production API ([design_p3_infrastructure.md §3.2]) is same-origin
// and normally skips CORS. The allowlist exists for local SPA dev and for the
// documented api.leverie.dev fallback, where credentials must be explicit.
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => resolveCorsOrigin(origin, c.env),
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/', (c) => c.text('LEVERIE API'));

// Liveness only — cheap, no DB, no auth. Safe to expose for load-balancer
// pings. The DB connectivity probe lives at /healthz/db so an attacker cannot
// turn the public health endpoint into a Neon-amplification DoS by flooding it.
app.get('/healthz', (c) => c.json({ ok: true }));

// Deep health probe. Hits the database. Mounted off the SPA path so it is
// not exercised by the editor itself; only synthetic monitors (UptimeRobot /
// BetterStack) should call it, and even then we cap them via the bodyLimit
// above. Errors return a generic code so a misconfigured DSN cannot leak to
// the public response.
app.get('/healthz/db', async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    await db.execute('select 1');
    return c.json({ ok: true });
  } catch (err) {
    console.error('healthz/db failed', err);
    return c.json({ ok: false, error: 'database_unreachable' }, 500);
  }
});

app.post('/api/auth/sign-up/email', async (c) => {
  const body = await c.req.raw
    .clone()
    .json()
    .catch(() => null);
  const email =
    body && typeof body === 'object' && 'email' in body
      ? (body as { email?: unknown }).email
      : null;

  if (typeof email === 'string') {
    const db = createDb(c.env.DATABASE_URL);
    const [existingUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, email.trim().toLowerCase()))
      .limit(1);

    if (existingUser) {
      return c.json(
        {
          code: 'USER_ALREADY_EXISTS',
          message: 'An account already exists for this email address.',
        },
        422,
      );
    }
  }

  const db = createDb(c.env.DATABASE_URL);
  const auth = createAuth(db, {
    baseURL: c.env.BETTER_AUTH_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    trustedOrigins: getAllowedOrigins(c.env),
    googleClientId: c.env.GOOGLE_CLIENT_ID,
    googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
    resendApiKey: c.env.RESEND_API_KEY,
    emailFrom: c.env.EMAIL_FROM,
    secondaryStorage: resolveSecondaryStorage(c.env),
  });
  return auth.handler(c.req.raw);
});

// Better Auth router. Mounted at /api/auth/* by convention; Better Auth handles
// sign-up / sign-in / OAuth / session refresh / sign-out endpoints internally.
app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const auth = createAuth(db, {
    baseURL: c.env.BETTER_AUTH_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    trustedOrigins: getAllowedOrigins(c.env),
    googleClientId: c.env.GOOGLE_CLIENT_ID,
    googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
    resendApiKey: c.env.RESEND_API_KEY,
    emailFrom: c.env.EMAIL_FROM,
    secondaryStorage: resolveSecondaryStorage(c.env),
  });
  return auth.handler(c.req.raw);
});

app.route('/', orgRoutes);
app.route('/', workspaceRoutes);
app.route('/', logicRoutes);
app.route('/', apiKeyRoutes);

// /v1/* — external public API surface (Bearer auth, no cookies, permissive
// CORS). Mounted after /api/* but before the scheduled handler.
app.use(
  '/v1/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);
// P4.6 — Public OpenAPI 3.1 document for the /v1/* surface. Unauthenticated
// (the spec describes the auth scheme; requiring auth to read it would defeat
// SDK generators / MCP catalogs / Scalar). Cached for 1 hour at the edge so
// the API worker isn't billed for every docs render. BETTER_AUTH_URL is the
// canonical absolute URL of this API origin in every environment (set in
// wrangler.toml per env); when empty, buildOpenApiDocument falls back to a
// relative `/` server URL so the document is still valid OpenAPI.
app.get('/v1/openapi.json', (c) => {
  const serverUrl = c.env.BETTER_AUTH_URL?.trim() || undefined;
  const document = buildOpenApiDocument({ serverUrl });
  return c.json(document, 200, {
    'Cache-Control': 'public, max-age=3600',
  });
});

app.route('/', evaluateRoutes);
app.route('/', mcpRoutes);

// Hourly sweep that physically deletes abandoned sign-up rows so an attacker
// cannot fill the `user` table (and indefinitely squat on real email
// addresses via the UNIQUE constraint on user.email) by spamming sign-up
// requests against random mailboxes.
//
// Safety filter: only deletes rows that never verified AND have no membership
// / audit / execution_log references. Unverified users cannot legitimately
// reach those code paths today, so the NOT EXISTS clauses are defensive
// belt-and-suspenders against schema drift. session and account rows cascade
// via the user FK; the verification table has no FK back to user, so we
// separately sweep expired verification rows.
export async function runScheduledMaintenance(env: Env) {
  const db = createDb(env.DATABASE_URL);
  await db.execute(sql`
    DELETE FROM "user"
    WHERE email_verified_at IS NULL
      AND deleted_at IS NULL
      AND created_at < now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM membership WHERE membership.user_id = "user".id
      )
      AND NOT EXISTS (
        SELECT 1 FROM audit_event WHERE audit_event.actor_user_id = "user".id
      )
      AND NOT EXISTS (
        SELECT 1 FROM execution_log WHERE execution_log.caller_user_id = "user".id
      )
  `);
  await db.execute(sql`
    DELETE FROM verification
    WHERE expires_at < now() - interval '7 days'
  `);
  await db.execute(sql`
    DELETE FROM invitation
    WHERE (
        expires_at < now() - interval '30 days'
        OR revoked_at < now() - interval '30 days'
      )
      AND accepted_at IS NULL
  `);
}

export default {
  fetch: app.fetch.bind(app),
  scheduled: async (
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(runScheduledMaintenance(env));
  },
};
