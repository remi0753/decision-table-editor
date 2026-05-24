import type { KvLikeNamespace } from './secondaryStorage.js';

// Worker bindings — kept in one place so route handlers can reference a single
// type. Secrets (DATABASE_URL, BETTER_AUTH_SECRET, OAuth credentials) are set via
// `wrangler secret put` per environment; non-secret vars live in wrangler.toml.
export type Env = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ALLOWED_ORIGINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  // Cloudflare KV namespace backing Better Auth's rate-limit counters. Optional
  // so `wrangler dev` works without provisioning KV (the auth handler falls
  // back to in-memory storage — see resolveSecondaryStorage).
  RATE_LIMIT_KV?: KvLikeNamespace;
};
