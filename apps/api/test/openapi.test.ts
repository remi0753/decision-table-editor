// P4.6 — Contract tests for the public OpenAPI document and its serving route.
// Two surfaces under test:
//   * buildOpenApiDocument()  — pure function shape (paths, schemas, security)
//   * GET /v1/openapi.json    — route wiring (status, content-type, cache, CORS,
//                                no auth required, server url propagated)

import { describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { buildOpenApiDocument } from '../src/openapi.js';

const baseEnv = {
  DATABASE_URL: 'postgres://unit-test',
  BETTER_AUTH_URL: 'https://leverie.dev',
  BETTER_AUTH_SECRET: 'test-secret',
  CORS_ALLOWED_ORIGINS: '',
};

describe('buildOpenApiDocument', () => {
  it('emits an OpenAPI 3.1 document covering the public /v1 surface', () => {
    const doc = buildOpenApiDocument({ serverUrl: 'https://leverie.dev' }) as {
      openapi: string;
      info: { title: string; version: string };
      servers: Array<{ url: string }>;
      paths: Record<string, unknown>;
      components: { securitySchemes: Record<string, unknown> };
    };

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('LEVERIE Hosted API');
    expect(doc.servers[0]?.url).toBe('https://leverie.dev');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/v1/logics/{logicId}/evaluate',
        '/v1/mcp',
        '/v1/openapi.json',
      ]),
    );
    expect(doc.components.securitySchemes).toHaveProperty('apiKeyAuth');
  });

  it('strips trailing slashes from the server url and falls back to "/"', () => {
    const trailing = buildOpenApiDocument({
      serverUrl: 'https://leverie.dev/',
    }) as { servers: Array<{ url: string }> };
    expect(trailing.servers[0]?.url).toBe('https://leverie.dev');

    const fallback = buildOpenApiDocument() as {
      servers: Array<{ url: string }>;
    };
    expect(fallback.servers[0]?.url).toBe('/');
  });

  it('marks the OpenAPI document endpoint itself as unauthenticated', () => {
    const doc = buildOpenApiDocument() as {
      paths: Record<string, { get?: { security?: unknown[] } }>;
    };
    const metaGet = doc.paths['/v1/openapi.json']?.get;
    expect(metaGet?.security).toEqual([]);
  });

  it('documents draft as non-callable on the evaluate endpoint', () => {
    const doc = buildOpenApiDocument() as {
      paths: Record<
        string,
        {
          post?: {
            parameters?: Array<{ name: string; schema?: { pattern?: string } }>;
          };
        }
      >;
    };
    const evaluateParams =
      doc.paths['/v1/logics/{logicId}/evaluate']?.post?.parameters ?? [];
    const versionParam = evaluateParams.find((p) => p.name === 'version');
    expect(versionParam).toBeDefined();
    expect(versionParam?.schema?.pattern).toBe(
      '^(production|latest|v[1-9][0-9]{0,8})$',
    );
  });
});

describe('GET /v1/openapi.json', () => {
  it('serves the spec without authentication', async () => {
    const response = await app.fetch(
      new Request('https://leverie.dev/v1/openapi.json'),
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');

    const body = (await response.json()) as {
      openapi: string;
      servers: Array<{ url: string }>;
    };
    expect(body.openapi).toBe('3.1.0');
    expect(body.servers[0]?.url).toBe('https://leverie.dev');
  });

  it('responds without the Authorization header even when CORS is permissive', async () => {
    const response = await app.fetch(
      new Request('https://leverie.dev/v1/openapi.json', {
        headers: { origin: 'https://example.com' },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    // The /v1/* surface uses `cors({ origin: '*' })`; the spec must be readable
    // from any origin so docs renderers and SDK generators can fetch it.
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('falls back to a relative server url when BETTER_AUTH_URL is empty', async () => {
    const response = await app.fetch(
      new Request('https://leverie.dev/v1/openapi.json'),
      { ...baseEnv, BETTER_AUTH_URL: '' },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { servers: Array<{ url: string }> };
    expect(body.servers[0]?.url).toBe('/');
  });
});
