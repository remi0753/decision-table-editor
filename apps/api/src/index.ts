import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { createAuth } from './auth.js';
import { createDb } from './db/client.js';
import type { Env } from './env.js';
import { getAllowedOrigins, resolveCorsOrigin } from './origins.js';
import { logicRoutes } from './routes/logics.js';
import { orgRoutes } from './routes/orgs.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { resolveSecondaryStorage } from './secondaryStorage.js';

export const app = new Hono<{ Bindings: Env }>();

// 1 MB ceiling on request bodies under /api/*. The largest legitimate payload
// is a logic draft (jsonb), and the editor caps real-world drafts well under
// this. Without the limit, an attacker can OOM a Worker isolate by streaming
// hundreds of megabytes into c.req.json().
const API_MAX_BODY_BYTES = 1024 * 1024;

app.use(
  '/api/*',
  bodyLimit({
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
  }),
);

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
