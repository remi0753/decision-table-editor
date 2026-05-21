import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './auth.js';
import { createDb } from './db/client.js';
import type { Env } from './env.js';
import { getAllowedOrigins, resolveCorsOrigin } from './origins.js';
import { orgRoutes } from './routes/orgs.js';

const app = new Hono<{ Bindings: Env }>();

// Path-based production API ([design_p3_infrastructure.md §3.2]) is same-origin
// and normally skips CORS. The allowlist exists for local SPA dev and for the
// documented api.leverie.dev fallback, where credentials must be explicit.
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => resolveCorsOrigin(origin, c.env),
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/', (c) => c.text('LEVERIE API'));

app.get('/healthz', async (c) => {
  // Liveness + DB connectivity. Returns 500 if the Neon path is unreachable
  // (useful as a synthetic check from UptimeRobot / BetterStack).
  try {
    const db = createDb(c.env.DATABASE_URL);
    await db.execute('select 1');
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
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
  });
  return auth.handler(c.req.raw);
});

app.route('/', orgRoutes);

export default app;
