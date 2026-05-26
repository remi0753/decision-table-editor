import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index.js';

type HonoRoute = {
  method: string;
  path: string;
};

const sourceRoot = resolve(import.meta.dirname, '..');
const serverSourceRoot = resolve(sourceRoot, '..', '..', 'packages', 'server');

function readServerSource(path: string) {
  return readFileSync(resolve(serverSourceRoot, path), 'utf8');
}

function routeSignatures() {
  return ((app as unknown as { routes: HonoRoute[] }).routes ?? []).map(
    (route) => `${route.method} ${route.path}`,
  );
}

describe('API endpoint contract', () => {
  it('registers the documented public endpoints', () => {
    expect(routeSignatures()).toEqual(
      expect.arrayContaining([
        'GET /',
        'GET /healthz',
        'GET /healthz/db',
        'GET /api/auth/*',
        'POST /api/auth/*',
        'POST /api/auth/sign-up/email',
        'GET /api/me',
        'GET /api/orgs',
        'POST /api/orgs',
        'PATCH /api/orgs/:orgId',
        'DELETE /api/orgs/:orgId',
        'GET /api/orgs/:orgId/workspaces',
        'POST /api/orgs/:orgId/workspaces',
        'PATCH /api/workspaces/:workspaceId',
        'DELETE /api/workspaces/:workspaceId',
        'GET /api/workspaces/:workspaceId/logics',
        'POST /api/workspaces/:workspaceId/logics',
        'GET /api/workspaces/:workspaceId/api-keys',
        'POST /api/workspaces/:workspaceId/api-keys',
        'PATCH /api/api-keys/:apiKeyId',
        'POST /api/api-keys/:apiKeyId/revoke',
        'GET /api/logics/:logicId',
        'POST /api/logics/:logicId/runner-share',
        'PATCH /api/logics/:logicId',
        'DELETE /api/logics/:logicId',
        'GET /api/logics/:logicId/versions',
        'GET /api/logics/:logicId/versions/:versionNumber',
        'POST /api/logics/:logicId/publish',
        'POST /api/logics/:logicId/production',
        'GET /api/logics/:logicId/diff',
        'GET /api/orgs/:orgId/members',
        'PATCH /api/orgs/:orgId/members/:membershipId',
        'DELETE /api/orgs/:orgId/members/:membershipId',
        'GET /api/orgs/:orgId/invitations',
        'POST /api/orgs/:orgId/invitations',
        'POST /api/orgs/:orgId/invitations/:invitationId/revoke',
        'GET /api/invitations/preview',
        'POST /api/invitations/accept',
        'POST /v1/logics/:logicId/evaluate',
        'POST /v1/mcp',
        'GET /v1/openapi.json',
      ]),
    );
  });

  it('keeps same-origin API CORS constrained to explicit dev/fallback origins', () => {
    const indexSource = readServerSource('src/index.ts');

    expect(indexSource).toContain("app.use('/api/*'");
    expect(indexSource).toContain('resolveCorsOrigin(origin, c.env)');
    expect(indexSource).toContain('credentials: true');
    expect(indexSource).toContain(
      "allowHeaders: ['Content-Type', 'Authorization']",
    );
    expect(indexSource).toContain(
      "allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']",
    );
  });

  it('keeps Better Auth sessions backed by the database despite secondary storage', () => {
    const authSource = readServerSource('src/auth.ts');

    expect(authSource).toContain('storeSessionInDatabase: true');
  });

  it('uses the native scrypt password handler for Workers CPU budget', () => {
    const authSource = readServerSource('src/auth.ts');
    const passwordSource = readServerSource('src/password.ts');

    expect(authSource).toContain(
      "import { hashPassword, verifyPassword } from './password.js'",
    );
    expect(authSource).toContain(
      'password: {\n        hash: hashPassword,\n        verify: verifyPassword',
    );
    expect(passwordSource).toContain("from 'node:crypto'");
  });

  it('rejects cross-site and non-JSON state-changing API requests before routes', async () => {
    const env = {
      DATABASE_URL: 'postgres://unit-test',
      BETTER_AUTH_URL: 'https://leverie.dev',
      BETTER_AUTH_SECRET: 'test-secret',
      CORS_ALLOWED_ORIGINS: '',
    };

    const crossSite = await app.fetch(
      new Request('https://leverie.dev/api/orgs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({ name: 'Acme' }),
      }),
      env,
    );
    expect(crossSite.status).toBe(403);
    await expect(crossSite.json()).resolves.toMatchObject({
      error: { code: 'csrf_rejected' },
    });

    const nonJson = await app.fetch(
      new Request('https://leverie.dev/api/orgs', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          origin: 'https://leverie.dev',
        },
        body: '{"name":"Acme"}',
      }),
      env,
    );
    expect(nonJson.status).toBe(415);
    await expect(nonJson.json()).resolves.toMatchObject({
      error: { code: 'unsupported_media_type' },
    });
  });
});
