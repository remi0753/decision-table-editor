import type { Env } from './env.js';

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function parseConfiguredOrigins(value?: string) {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

export function getAllowedOrigins(env: Pick<Env, 'BETTER_AUTH_URL' | 'CORS_ALLOWED_ORIGINS'>) {
  const baseOrigin = originOf(env.BETTER_AUTH_URL);
  const configuredOrigins = parseConfiguredOrigins(env.CORS_ALLOWED_ORIGINS);
  const devOrigins =
    baseOrigin?.startsWith('http://localhost') ||
    baseOrigin?.startsWith('http://127.0.0.1')
      ? LOCAL_DEV_ORIGINS
      : [];

  return Array.from(
    new Set(
      [baseOrigin, ...configuredOrigins, ...devOrigins].filter(
        (origin): origin is string => Boolean(origin),
      ),
    ),
  );
}

export function resolveCorsOrigin(origin: string, env: Env) {
  if (!origin) return null;
  return getAllowedOrigins(env).includes(origin) ? origin : null;
}
