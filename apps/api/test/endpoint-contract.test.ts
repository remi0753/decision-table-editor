import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

type HonoRoute = {
  method: string;
  path: string;
};

const sourceRoot = resolve(import.meta.dirname, '..');

function readSource(path: string) {
  return readFileSync(resolve(sourceRoot, path), 'utf8');
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
        'GET /api/invitations/accept',
        'POST /api/invitations/accept',
      ]),
    );
  });

  it('keeps same-origin API CORS constrained to explicit dev/fallback origins', () => {
    const indexSource = readSource('src/index.ts');

    expect(indexSource).toContain("app.use(\n  '/api/*'");
    expect(indexSource).toContain('resolveCorsOrigin(origin, c.env)');
    expect(indexSource).toContain('credentials: true');
    expect(indexSource).toContain(
      "allowHeaders: ['Content-Type', 'Authorization']",
    );
    expect(indexSource).toContain(
      "allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']",
    );
  });
});
