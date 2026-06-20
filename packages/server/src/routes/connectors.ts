// Live data-source connectors (WP3/WP4): create database / HTTP(OpenAPI) data
// sources whose data is NEVER copied into LEVERIE. Credentials are encrypted via
// the connector secret store and only the secret_ref is kept on the data source.
// Admin+ only, since these hold credentials and reach external systems.

import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { putConnectorSecret } from '../connectors/secrets.js';
import { createDb } from '../db/client.js';
import { dataSource } from '../db/schema.js';
import type { Env } from '../env.js';
import {
  canManageDataSources,
  canViewWorkspaceData,
  jsonError,
  loadWorkspaceAccess,
  rolePersona,
  writeAudit,
} from './shared.js';

export const connectorRoutes = new Hono<{ Bindings: Env }>();

const LIVE_KINDS = ['database', 'openapi_http'] as const;
type LiveKind = (typeof LIVE_KINDS)[number];

interface ConnectorBody {
  name?: unknown;
  kind?: unknown;
  allowedDomains?: unknown;
  auth?: { type?: unknown; value?: unknown } | null;
}

function serializeSource(row: typeof dataSource.$inferSelect) {
  // Never serialize secret_ref to the browser.
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    authType: row.authType,
    allowedDomains: row.allowedDomains ?? [],
    status: row.status,
    createdAt: row.createdAt,
  };
}

// GET /api/workspaces/:workspaceId/data-sources — list all data sources (viewer+).
connectorRoutes.get('/api/workspaces/:workspaceId/data-sources', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadWorkspaceAccess(c, db, c.req.param('workspaceId'));
  if ('error' in access) return access.error;
  if (!canViewWorkspaceData(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
  }
  const rows = await db
    .select()
    .from(dataSource)
    .where(eq(dataSource.workspaceId, access.workspace.id))
    .orderBy(desc(dataSource.createdAt));
  return c.json({ dataSources: rows.map(serializeSource) });
});

// POST /api/workspaces/:workspaceId/data-sources — create a live connector (admin+).
connectorRoutes.post('/api/workspaces/:workspaceId/data-sources', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadWorkspaceAccess(c, db, c.req.param('workspaceId'));
  if ('error' in access) return access.error;
  if (!canManageDataSources(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
  }

  const body = (await c.req.json().catch(() => null)) as ConnectorBody | null;
  if (!body || typeof body !== 'object') {
    return jsonError(c, 400, 'invalid_body', 'Request body is required.');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    return jsonError(c, 400, 'invalid_name', 'A name (max 120) is required.');
  }
  if (
    typeof body.kind !== 'string' ||
    !LIVE_KINDS.includes(body.kind as LiveKind)
  ) {
    return jsonError(
      c,
      400,
      'invalid_kind',
      `kind must be one of: ${LIVE_KINDS.join(', ')}.`,
    );
  }
  const kind = body.kind as LiveKind;

  // HTTP connectors must carry an allow-list (fail closed at resolve time).
  let allowedDomains: string[] | null = null;
  if (kind === 'openapi_http') {
    if (
      !Array.isArray(body.allowedDomains) ||
      body.allowedDomains.length === 0 ||
      !body.allowedDomains.every((d) => typeof d === 'string' && d.trim())
    ) {
      return jsonError(
        c,
        400,
        'allowed_domains_required',
        'HTTP connectors require a non-empty allowedDomains list.',
      );
    }
    allowedDomains = (body.allowedDomains as string[]).map((d) => d.trim());
  }

  // Optional credential, encrypted into the connector secret store.
  let secretRef: string | null = null;
  let authType = 'none';
  if (body.auth && typeof body.auth === 'object') {
    const at = (body.auth as { type?: unknown }).type;
    const value = (body.auth as { value?: unknown }).value;
    const allowed =
      kind === 'database' ? ['database_url'] : ['api_key', 'bearer', 'basic'];
    if (typeof at !== 'string' || !allowed.includes(at)) {
      return jsonError(
        c,
        400,
        'invalid_auth',
        'auth.type is invalid for this kind.',
      );
    }
    if (!value || typeof value !== 'object') {
      return jsonError(c, 400, 'invalid_auth', 'auth.value is required.');
    }
    const stringValue: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string') stringValue[k] = v;
    }
    try {
      secretRef = await putConnectorSecret({
        db,
        env: c.env,
        workspaceId: access.workspace.id,
        actorUserId: access.user.id,
        authType: at,
        value: stringValue,
      });
    } catch (e) {
      return jsonError(
        c,
        500,
        'secret_store_failed',
        e instanceof Error ? e.message : 'Could not store credential.',
      );
    }
    authType = kind === 'database' ? 'none' : at;
  }

  const [created] = await db
    .insert(dataSource)
    .values({
      workspaceId: access.workspace.id,
      name,
      kind,
      schema: {},
      authType,
      secretRef,
      allowedDomains,
      ownerUserId: access.user.id,
      status: 'active',
      createdActorType: 'user',
      createdActorId: access.user.id,
    })
    .returning();
  if (!created) {
    return jsonError(c, 500, 'connector_create_failed', 'Could not create.');
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.workspace.id,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'data_source.created',
    targetType: 'data_source',
    targetId: created.id,
    metadata: { kind, name, hasSecret: secretRef !== null },
  });

  return c.json({ dataSource: serializeSource(created) }, 201);
});

// POST /api/data-sources/:dataSourceId/disable — turn a connector off (admin+).
connectorRoutes.post('/api/data-sources/:dataSourceId/disable', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [src] = await db
    .select()
    .from(dataSource)
    .where(eq(dataSource.id, c.req.param('dataSourceId')))
    .limit(1);
  if (!src) return jsonError(c, 404, 'not_found', 'Data source not found.');
  const access = await loadWorkspaceAccess(c, db, src.workspaceId);
  if ('error' in access) return access.error;
  if (!canManageDataSources(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
  }
  const [updated] = await db
    .update(dataSource)
    .set({
      status: 'disabled',
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(
      and(
        eq(dataSource.id, src.id),
        eq(dataSource.workspaceId, src.workspaceId),
      ),
    )
    .returning();
  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: src.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'data_source.disabled',
    targetType: 'data_source',
    targetId: src.id,
    metadata: {},
  });
  return c.json({ dataSource: serializeSource(updated ?? src) });
});
