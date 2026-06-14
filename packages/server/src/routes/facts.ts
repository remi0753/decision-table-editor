import { and, desc, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  type FactInputDraft,
  type FactKind,
  normalizeAlias,
  validateAliases,
  validateEnumValues,
  validateFactCreate,
} from '../dataWorkspace/factValidation.js';
import { createDb, type Database } from '../db/client.js';
import { factDefinition, workspace } from '../db/schema.js';
import type { Env } from '../env.js';
import {
  type AppContext,
  canEditLogics,
  canManageDataSources,
  canViewWorkspaceData,
  jsonError,
  loadWorkspaceAccess,
  parseBodyBoolean,
  type Role,
  type RouteError,
  requireMembership,
  rolePersona,
  type WorkspaceAccess,
  writeAudit,
} from './shared.js';

export const factRoutes = new Hono<{ Bindings: Env }>();

type FactRow = typeof factDefinition.$inferSelect;

function serializeFact(row: FactRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    type: row.type,
    enumValues: (row.enumValues as string[] | null) ?? null,
    kind: row.kind,
    aliases: (row.aliases as string[]) ?? [],
    question: row.question,
    sensitive: row.sensitive,
    loggingPolicy: row.loggingPolicy,
    retentionPolicy: row.retentionPolicy,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Manual and key facts are author-level (editor+); system and internal facts
// touch data resolution and sensitive policy, so they are admin+ (§5.1, §10.1).
function canManageFactKind(role: Role, kind: FactKind) {
  if (kind === 'system_fact' || kind === 'internal_fact') {
    return canManageDataSources(role);
  }
  return canEditLogics(role);
}

type FactAccess = WorkspaceAccess & { fact: FactRow };

async function loadFactAccess(
  c: AppContext,
  db: Database,
  factId: string,
): Promise<FactAccess | RouteError> {
  const [row] = await db
    .select({ fact: factDefinition, workspace })
    .from(factDefinition)
    .innerJoin(workspace, eq(factDefinition.workspaceId, workspace.id))
    .where(eq(factDefinition.id, factId))
    .limit(1);

  if (!row) return { error: jsonError(c, 404, 'not_found', 'Fact not found.') };

  const access = await requireMembership(c, db, row.workspace.orgId);
  if ('error' in access) return access;

  return { fact: row.fact, workspace: row.workspace, ...access };
}

// Detect aliases that collide (after normalization) with aliases already used
// by other non-deprecated facts in the same workspace. SQL cannot express
// alias uniqueness across JSON arrays, so it is enforced here (§3.1, §5.1).
async function findAliasConflict(
  db: Database,
  workspaceId: string,
  aliases: string[],
  excludeFactId?: string,
): Promise<string | null> {
  if (aliases.length === 0) return null;
  const wanted = new Set(aliases.map(normalizeAlias));

  const rows = await db
    .select({ id: factDefinition.id, aliases: factDefinition.aliases })
    .from(factDefinition)
    .where(
      and(
        eq(factDefinition.workspaceId, workspaceId),
        ne(factDefinition.status, 'deprecated'),
      ),
    );

  for (const row of rows) {
    if (excludeFactId && row.id === excludeFactId) continue;
    for (const existing of (row.aliases as string[]) ?? []) {
      if (wanted.has(normalizeAlias(existing))) return existing;
    }
  }
  return null;
}

// GET /api/workspaces/:workspaceId/facts — list facts (viewer+).
factRoutes.get('/api/workspaces/:workspaceId/facts', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;
  if (!canViewWorkspaceData(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
  }

  const rows = await db
    .select()
    .from(factDefinition)
    .where(eq(factDefinition.workspaceId, workspaceId))
    .orderBy(desc(factDefinition.createdAt));

  return c.json({ facts: rows.map(serializeFact) });
});

// POST /api/workspaces/:workspaceId/facts — create a fact.
factRoutes.post('/api/workspaces/:workspaceId/facts', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;

  const body = (await c.req.json().catch(() => null)) as FactInputDraft | null;
  if (!body || typeof body !== 'object') {
    return jsonError(c, 400, 'invalid_body', 'Request body is required.');
  }

  const result = validateFactCreate(body);
  if (!result.ok) {
    return jsonError(c, 400, result.error.code, result.error.message);
  }
  const fact = result.value;

  if (!canManageFactKind(access.member.role, fact.kind)) {
    return jsonError(
      c,
      403,
      'forbidden',
      'You do not have permission to create this kind of fact.',
    );
  }
  // Sensitive full logging is an explicit admin/owner choice (§5.1, §10.2).
  if (
    fact.sensitive &&
    fact.loggingPolicy === 'full' &&
    !canManageDataSources(access.member.role)
  ) {
    return jsonError(
      c,
      403,
      'sensitive_logging_forbidden',
      'Full logging of a sensitive fact requires admin or owner.',
    );
  }

  const aliasConflict = await findAliasConflict(db, workspaceId, fact.aliases);
  if (aliasConflict) {
    return jsonError(
      c,
      409,
      'duplicate_alias',
      `Alias "${aliasConflict}" is already used by another fact.`,
    );
  }

  let created: FactRow | undefined;
  try {
    [created] = await db
      .insert(factDefinition)
      .values({
        workspaceId,
        name: fact.name,
        description: fact.description,
        type: fact.type,
        enumValues: fact.enumValues,
        kind: fact.kind,
        aliases: fact.aliases,
        question: fact.question,
        sensitive: fact.sensitive,
        loggingPolicy: fact.loggingPolicy,
        status: fact.status,
        createdActorType: 'user',
        createdActorId: access.user.id,
      })
      .returning();
  } catch (error) {
    const maybeError = error as { code?: string; constraint?: string };
    if (
      maybeError.code === '23505' &&
      maybeError.constraint === 'fact_definition_workspace_name_active_uniq'
    ) {
      return jsonError(
        c,
        409,
        'duplicate_name',
        'A fact with this name already exists in the workspace.',
      );
    }
    throw error;
  }

  if (!created) {
    return jsonError(c, 500, 'fact_create_failed', 'Could not create fact.');
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'fact.created',
    targetType: 'fact',
    targetId: created.id,
    metadata: { kind: created.kind, name: created.name },
  });

  return c.json({ fact: serializeFact(created) }, 201);
});

// GET /api/facts/:factId — read a single fact (viewer+).
factRoutes.get('/api/facts/:factId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadFactAccess(c, db, c.req.param('factId'));
  if ('error' in access) return access.error;
  if (!canViewWorkspaceData(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
  }
  return c.json({ fact: serializeFact(access.fact) });
});

// PATCH /api/facts/:factId — update mutable fields of a fact.
factRoutes.patch('/api/facts/:factId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadFactAccess(c, db, c.req.param('factId'));
  if ('error' in access) return access.error;
  const existing = access.fact;

  if (!canManageFactKind(access.member.role, existing.kind as FactKind)) {
    return jsonError(
      c,
      403,
      'forbidden',
      'You do not have permission to edit this kind of fact.',
    );
  }

  const body = (await c.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== 'object') {
    return jsonError(c, 400, 'invalid_body', 'Request body is required.');
  }

  const update: Partial<typeof factDefinition.$inferInsert> = {
    updatedActorType: 'user',
    updatedActorId: access.user.id,
  };

  // Kind and type are structural; for the MVP they are immutable once created
  // (changing them would invalidate existing bindings). Editable fields below.
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name || name.length > 120) {
      return jsonError(c, 400, 'invalid_name', 'name is invalid.');
    }
    update.name = name;
  }
  if (body.description !== undefined) {
    if (body.description === null) {
      update.description = null;
    } else if (typeof body.description === 'string') {
      const trimmed = body.description.trim();
      if (trimmed.length > 1000) {
        return jsonError(
          c,
          400,
          'description_too_long',
          'description is too long.',
        );
      }
      update.description = trimmed || null;
    } else {
      return jsonError(
        c,
        400,
        'invalid_description',
        'description must be a string.',
      );
    }
  }
  if (body.enumValues !== undefined) {
    const enumResult = validateEnumValues(
      existing.type as 'enum',
      body.enumValues,
    );
    if (!enumResult.ok) {
      return jsonError(c, 400, enumResult.error.code, enumResult.error.message);
    }
    update.enumValues = enumResult.enumValues;
  }
  if (body.aliases !== undefined) {
    const aliasResult = validateAliases(body.aliases);
    if (!aliasResult.ok) {
      return jsonError(
        c,
        400,
        aliasResult.error.code,
        aliasResult.error.message,
      );
    }
    const conflict = await findAliasConflict(
      db,
      existing.workspaceId,
      aliasResult.aliases,
      existing.id,
    );
    if (conflict) {
      return jsonError(
        c,
        409,
        'duplicate_alias',
        `Alias "${conflict}" is already used by another fact.`,
      );
    }
    update.aliases = aliasResult.aliases;
  }
  if (body.question !== undefined) {
    update.question =
      body.question === null
        ? null
        : typeof body.question === 'string'
          ? body.question.trim() || null
          : undefined;
    if (update.question === undefined) {
      return jsonError(
        c,
        400,
        'invalid_question',
        'question must be a string.',
      );
    }
  }
  if (body.sensitive !== undefined) {
    update.sensitive = parseBodyBoolean(body, 'sensitive', existing.sensitive);
  }
  if (typeof body.loggingPolicy === 'string') {
    if (!['full', 'masked', 'hash', 'omit'].includes(body.loggingPolicy)) {
      return jsonError(
        c,
        400,
        'invalid_logging_policy',
        'loggingPolicy is invalid.',
      );
    }
    update.loggingPolicy = body.loggingPolicy;
  }
  if (typeof body.status === 'string') {
    if (!['draft', 'active', 'deprecated'].includes(body.status)) {
      return jsonError(c, 400, 'invalid_status', 'status is invalid.');
    }
    update.status = body.status;
  }

  // Re-check the sensitive+full-logging guard against the resulting state.
  const resultingSensitive = update.sensitive ?? existing.sensitive;
  const resultingPolicy = update.loggingPolicy ?? existing.loggingPolicy;
  if (
    resultingSensitive &&
    resultingPolicy === 'full' &&
    !canManageDataSources(access.member.role)
  ) {
    return jsonError(
      c,
      403,
      'sensitive_logging_forbidden',
      'Full logging of a sensitive fact requires admin or owner.',
    );
  }

  // Active manual facts must keep a question (mirrors the DB CHECK so we return
  // a clean error instead of a raw constraint violation).
  const resultingStatus = update.status ?? existing.status;
  const resultingQuestion =
    update.question !== undefined ? update.question : existing.question;
  if (
    existing.kind === 'manual_fact' &&
    resultingStatus === 'active' &&
    !resultingQuestion?.trim()
  ) {
    return jsonError(
      c,
      400,
      'question_required',
      'Active manual facts require a question.',
    );
  }

  update.version = existing.version + 1;

  let updated: FactRow | undefined;
  try {
    [updated] = await db
      .update(factDefinition)
      .set(update)
      .where(eq(factDefinition.id, existing.id))
      .returning();
  } catch (error) {
    const maybeError = error as { code?: string; constraint?: string };
    if (
      maybeError.code === '23505' &&
      maybeError.constraint === 'fact_definition_workspace_name_active_uniq'
    ) {
      return jsonError(
        c,
        409,
        'duplicate_name',
        'A fact with this name already exists in the workspace.',
      );
    }
    throw error;
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: existing.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'fact.updated',
    targetType: 'fact',
    targetId: existing.id,
  });

  return c.json({ fact: serializeFact(updated ?? existing) });
});

// POST /api/facts/:factId/deprecate — retire a fact from the catalog.
factRoutes.post('/api/facts/:factId/deprecate', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadFactAccess(c, db, c.req.param('factId'));
  if ('error' in access) return access.error;
  const existing = access.fact;

  if (!canManageFactKind(access.member.role, existing.kind as FactKind)) {
    return jsonError(
      c,
      403,
      'forbidden',
      'You do not have permission to deprecate this kind of fact.',
    );
  }

  if (existing.status === 'deprecated') {
    return c.json({ fact: serializeFact(existing) });
  }

  const [updated] = await db
    .update(factDefinition)
    .set({
      status: 'deprecated',
      version: existing.version + 1,
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(eq(factDefinition.id, existing.id))
    .returning();

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: existing.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'fact.deprecated',
    targetType: 'fact',
    targetId: existing.id,
  });

  return c.json({ fact: serializeFact(updated ?? existing) });
});
