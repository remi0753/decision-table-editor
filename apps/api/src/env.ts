// Worker bindings — kept in one place so route handlers can reference a single
// type. Secrets (DATABASE_URL, BETTER_AUTH_SECRET) are set via
// `wrangler secret put` per environment; non-secret vars live in wrangler.toml.
export type Env = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ALLOWED_ORIGINS?: string;
};
