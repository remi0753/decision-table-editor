import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb, type Database } from '../db/client.js';
import { apiKey, apiKeyLogicScope, logic, workspace } from '../db/schema.js';
import type { Env } from '../env.js';
import { hashPassword } from '../password.js';
import {
  type AppContext,
  canManageMembers,
  jsonError,
  type MembershipAccess,
  parseBodyString,
  randomToken,
  requireMembership,
  rolePersona,
  writeAudit,
} from './shared.js';

type ApiKeyRole = 'editor' | 'viewer' | 'runner';
type ScopeMode = 'all' | 'allowlist';
type RouteError = { error: ReturnType<typeof jsonError> };
type WorkspaceAccess = MembershipAccess & {
  workspace: typeof workspace.$inferSelect;
};
type ApiKeyAccess = WorkspaceAccess & {
  apiKey: typeof apiKey.$inferSelect;
};

const apiKeyRoles: ApiKeyRole[] = ['editor', 'viewer', 'runner'];
const scopeModes: ScopeMode[] = ['all', 'allowlist'];

export const apiKeyRoutes = new Hono<{ Bindings: Env }>();

function parseBodyStringArray(body: unknown, field: string) {
  if (!body || typeof body !== 'object' || !(field in body)) return undefined;
  const value = (body as Record<string, unknown>)[field];
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string')
  ) {
    return null;
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function parseApiKeyRole(body: unknown, required = true) {
  const value = parseBodyString(body, 'role', { required });
  if (value === undefined) return undefined;
  if (!value || !apiKeyRoles.includes(value as ApiKeyRole)) return null;
  return value as ApiKeyRole;
}

function parseScopeMode(body: unknown, required = true) {
  const value = parseBodyString(body, 'scopeMode', { required });
  if (value === undefined) return undefined;
  if (!value || !scopeModes.includes(value as ScopeMode)) return null;
  return value as ScopeMode;
}

function parseExpiresAt(body: unknown) {
  const value = parseBodyString(body, 'expiresAt');
  if (value === undefined) return undefined;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseKeyRing(c: AppContext) {
  if (!c.env.HMAC_KEY_RING_JSON) {
    return null;
  }

  try {
    const parsed = JSON.parse(c.env.HMAC_KEY_RING_JSON) as {
      active?: unknown;
      keys?: unknown;
    };
    if (
      typeof parsed.active !== 'string' ||
      !parsed.keys ||
      typeof parsed.keys !== 'object' ||
      Array.isArray(parsed.keys)
    ) {
      return null;
    }

    const activeSecret = (parsed.keys as Record<string, unknown>)[
      parsed.active
    ];
    if (typeof activeSecret !== 'string' || activeSecret.length < 32) {
      return null;
    }

    return { version: parsed.active, secret: activeSecret };
  } catch {
    return null;
  }
}

async function hmacSha256Base64Url(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  );
  const raw = Array.from(new Uint8Array(signature), (byte) =>
    String.fromCharCode(byte),
  ).join('');
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function loadWorkspaceAccess(
  c: AppContext,
  db: Database,
  workspaceId: string,
): Promise<WorkspaceAccess | RouteError> {
  const [row] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, workspaceId), isNull(workspace.deletedAt)))
    .limit(1);

  if (!row) {
    return { error: jsonError(c, 404, 'not_found', 'Workspace not found.') };
  }

  const access = await requireMembership(c, db, row.orgId);
  if ('error' in access) return access;
  if (!canManageMembers(access.member.role)) {
    return {
      error: jsonError(
        c,
        403,
        'forbidden',
        'Only org owners and admins can manage API keys.',
      ),
    };
  }

  return { workspace: row, ...access };
}

async function loadApiKeyAccess(
  c: AppContext,
  db: Database,
  apiKeyId: string,
): Promise<ApiKeyAccess | RouteError> {
  const [row] = await db
    .select({ apiKey, workspace })
    .from(apiKey)
    .innerJoin(workspace, eq(apiKey.workspaceId, workspace.id))
    .where(and(eq(apiKey.id, apiKeyId), isNull(workspace.deletedAt)))
    .limit(1);

  if (!row) {
    return { error: jsonError(c, 404, 'not_found', 'API key not found.') };
  }

  const access = await requireMembership(c, db, row.workspace.orgId);
  if ('error' in access) return access;
  if (!canManageMembers(access.member.role)) {
    return {
      error: jsonError(
        c,
        403,
        'forbidden',
        'Only org owners and admins can manage API keys.',
      ),
    };
  }

  return { apiKey: row.apiKey, workspace: row.workspace, ...access };
}

async function validateLogicAllowlist(
  c: AppContext,
  db: Database,
  workspaceId: string,
  scopeMode: ScopeMode,
  logicIds: string[] | undefined | null,
) {
  if (logicIds === null) {
    return {
      error: jsonError(c, 400, 'invalid_scope', 'logicIds must be an array.'),
    };
  }

  if (scopeMode === 'all') return { logicIds: [] as string[] };

  if (!logicIds?.length) {
    return {
      error: jsonError(
        c,
        400,
        'invalid_scope',
        'Allow-list API keys must include at least one logicId.',
      ),
    };
  }

  const rows = await db
    .select({ id: logic.id })
    .from(logic)
    .where(
      and(
        eq(logic.workspaceId, workspaceId),
        inArray(logic.id, logicIds),
        isNull(logic.deletedAt),
      ),
    );
  const found = new Set(rows.map((row) => row.id));
  const missing = logicIds.filter((id) => !found.has(id));

  if (missing.length > 0) {
    return {
      error: c.json(
        {
          error: {
            code: 'invalid_scope',
            message: 'All allow-listed logicIds must belong to this workspace.',
            missingLogicIds: missing,
          },
        },
        400,
      ),
    };
  }

  return { logicIds };
}

async function listApiKeyLogicIds(
  db: Database,
  input: { workspaceId: string; apiKeyId: string },
) {
  const rows = await db
    .select({ logicId: apiKeyLogicScope.logicId })
    .from(apiKeyLogicScope)
    .where(
      and(
        eq(apiKeyLogicScope.workspaceId, input.workspaceId),
        eq(apiKeyLogicScope.apiKeyId, input.apiKeyId),
      ),
    );
  return rows.map((row) => row.logicId);
}

function serializeApiKey(
  row: typeof apiKey.$inferSelect,
  logicIds: string[] = [],
) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    role: row.role,
    scopeMode: row.scopeMode,
    logicIds,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    createdActorType: row.createdActorType,
    createdActorId: row.createdActorId,
  };
}

apiKeyRoutes.get('/api/workspaces/:workspaceId/api-keys', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadWorkspaceAccess(c, db, c.req.param('workspaceId'));
  if ('error' in access) return access.error;

  const rows = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.workspaceId, access.workspace.id))
    .orderBy(sql`${apiKey.createdAt} DESC`);
  const scopeRows = await db
    .select()
    .from(apiKeyLogicScope)
    .where(eq(apiKeyLogicScope.workspaceId, access.workspace.id));
  const scopesByKey = new Map<string, string[]>();
  for (const row of scopeRows) {
    scopesByKey.set(row.apiKeyId, [
      ...(scopesByKey.get(row.apiKeyId) ?? []),
      row.logicId,
    ]);
  }

  return c.json({
    apiKeys: rows.map((row) => serializeApiKey(row, scopesByKey.get(row.id))),
  });
});

apiKeyRoutes.post('/api/workspaces/:workspaceId/api-keys', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadWorkspaceAccess(c, db, c.req.param('workspaceId'));
  if ('error' in access) return access.error;

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { required: true, max: 120 });
  const role = parseApiKeyRole(body);
  const scopeMode = parseScopeMode(body);
  const expiresAt = parseExpiresAt(body);
  const parsedLogicIds = parseBodyStringArray(body, 'logicIds');

  if (!name || !role || !scopeMode || expiresAt === null) {
    return jsonError(c, 400, 'invalid_request', 'Invalid API key payload.');
  }

  const scope = await validateLogicAllowlist(
    c,
    db,
    access.workspace.id,
    scopeMode,
    parsedLogicIds,
  );
  if ('error' in scope) return scope.error;

  const keyRing = parseKeyRing(c);
  if (!keyRing) {
    return jsonError(
      c,
      500,
      'api_key_secret_unconfigured',
      'API key signing secret is not configured.',
    );
  }

  const secret = `lvr_${randomToken(32)}`;
  const [created] = await db
    .insert(apiKey)
    .values({
      workspaceId: access.workspace.id,
      name,
      lookupSecretVersion: keyRing.version,
      lookupDigest: await hmacSha256Base64Url(keyRing.secret, secret),
      keyHash: await hashPassword(secret),
      keyPrefix: secret.slice(0, 12),
      role,
      scopeMode,
      expiresAt,
      createdActorType: 'user',
      createdActorId: access.user.id,
    })
    .returning();
  if (!created) {
    return jsonError(
      c,
      500,
      'api_key_create_failed',
      'API key was not created.',
    );
  }

  if (scope.logicIds.length > 0) {
    await db.insert(apiKeyLogicScope).values(
      scope.logicIds.map((logicId) => ({
        workspaceId: access.workspace.id,
        apiKeyId: created.id,
        logicId,
      })),
    );
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.workspace.id,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'api_key.created',
    targetType: 'api_key',
    targetId: created.id,
    metadata: { role, scopeMode, logicCount: scope.logicIds.length },
  });

  return c.json(
    {
      apiKey: serializeApiKey(created, scope.logicIds),
      secret,
    },
    201,
  );
});

apiKeyRoutes.patch('/api/api-keys/:apiKeyId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadApiKeyAccess(c, db, c.req.param('apiKeyId'));
  if ('error' in access) return access.error;
  if (access.apiKey.revokedAt) {
    return jsonError(c, 409, 'revoked', 'Revoked API keys cannot be changed.');
  }

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { max: 120 });
  const role = parseApiKeyRole(body, false);
  const scopeMode = parseScopeMode(body, false);
  const parsedLogicIds = parseBodyStringArray(body, 'logicIds');
  const nextScopeMode = scopeMode ?? (access.apiKey.scopeMode as ScopeMode);

  if (name === null || role === null || scopeMode === null) {
    return jsonError(c, 400, 'invalid_request', 'Invalid API key payload.');
  }

  const scope =
    scopeMode !== undefined || parsedLogicIds !== undefined
      ? await validateLogicAllowlist(
          c,
          db,
          access.workspace.id,
          nextScopeMode,
          parsedLogicIds ?? [],
        )
      : { logicIds: undefined };
  if ('error' in scope) return scope.error;

  if (
    name === undefined &&
    role === undefined &&
    scope.logicIds === undefined
  ) {
    return jsonError(c, 400, 'invalid_request', 'No API key changes provided.');
  }

  const set: Partial<typeof apiKey.$inferInsert> = {};
  if (name !== undefined) set.name = name;
  if (role !== undefined) set.role = role;
  if (scopeMode !== undefined) set.scopeMode = scopeMode;

  const [updated] =
    Object.keys(set).length > 0
      ? await db
          .update(apiKey)
          .set(set)
          .where(eq(apiKey.id, access.apiKey.id))
          .returning()
      : [access.apiKey];
  if (!updated) {
    return jsonError(
      c,
      500,
      'api_key_update_failed',
      'API key was not updated.',
    );
  }

  if (scope.logicIds !== undefined) {
    await db
      .delete(apiKeyLogicScope)
      .where(eq(apiKeyLogicScope.apiKeyId, access.apiKey.id));
    if (scope.logicIds.length > 0) {
      await db.insert(apiKeyLogicScope).values(
        scope.logicIds.map((logicId) => ({
          workspaceId: access.workspace.id,
          apiKeyId: access.apiKey.id,
          logicId,
        })),
      );
    }
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.workspace.id,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'api_key.updated',
    targetType: 'api_key',
    targetId: access.apiKey.id,
    metadata: {
      changed: {
        name: name !== undefined,
        role: role !== undefined,
        scope: scope.logicIds !== undefined,
      },
    },
  });

  const responseLogicIds =
    scope.logicIds ??
    (await listApiKeyLogicIds(db, {
      workspaceId: access.workspace.id,
      apiKeyId: access.apiKey.id,
    }));

  return c.json({
    apiKey: serializeApiKey(updated ?? access.apiKey, responseLogicIds),
  });
});

apiKeyRoutes.post('/api/api-keys/:apiKeyId/revoke', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadApiKeyAccess(c, db, c.req.param('apiKeyId'));
  if ('error' in access) return access.error;
  if (access.apiKey.revokedAt) {
    return c.json({ apiKey: serializeApiKey(access.apiKey) });
  }

  const [revoked] = await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(eq(apiKey.id, access.apiKey.id))
    .returning();

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.workspace.id,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'api_key.revoked',
    targetType: 'api_key',
    targetId: access.apiKey.id,
    metadata: {},
  });

  return c.json({ apiKey: serializeApiKey(revoked ?? access.apiKey) });
});
