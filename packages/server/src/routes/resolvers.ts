import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  type ResolverFactView,
  type ResolverRecipeDraft,
  validateResolverRecipe,
} from '../dataWorkspace/resolverValidation.js';
import { createDb, type Database } from '../db/client.js';
import {
  dataSource,
  factDefinition,
  referenceTable,
  referenceTableRow,
  resolverRecipe,
  workspace,
} from '../db/schema.js';
import type { Env } from '../env.js';
import { resolveReferenceTableRecipe } from '../resolvers/runtime.js';
import type {
  FactView,
  KeyColumnMapping,
  OutputMapping,
} from '../resolvers/types.js';
import {
  type AppContext,
  canManageDataSources,
  canViewWorkspaceData,
  jsonError,
  loadWorkspaceAccess,
  type RouteError,
  requireMembership,
  rolePersona,
  type WorkspaceAccess,
  writeAudit,
} from './shared.js';

export const resolverRoutes = new Hono<{ Bindings: Env }>();

type ResolverRow = typeof resolverRecipe.$inferSelect;
type ColumnDef = { name: string; factId?: string };

function serializeResolver(row: ResolverRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    inputFactIds: row.inputFactIds as string[],
    dataSourceId: row.dataSourceId,
    operationRef: row.operationRef,
    parameterMappings: row.parameterMappings,
    outputMappings: row.outputMappings,
    normalizers: row.normalizers,
    fallbackPolicy: row.fallbackPolicy,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type ResolverAccess = WorkspaceAccess & { recipe: ResolverRow };

async function loadResolverAccess(
  c: AppContext,
  db: Database,
  resolverId: string,
): Promise<ResolverAccess | RouteError> {
  const [row] = await db
    .select({ recipe: resolverRecipe, workspace })
    .from(resolverRecipe)
    .innerJoin(workspace, eq(resolverRecipe.workspaceId, workspace.id))
    .where(eq(resolverRecipe.id, resolverId))
    .limit(1);
  if (!row)
    return { error: jsonError(c, 404, 'not_found', 'Resolver not found.') };
  const access = await requireMembership(c, db, row.workspace.orgId);
  if ('error' in access) return access;
  return { recipe: row.recipe, workspace: row.workspace, ...access };
}

async function buildFactContext(db: Database, workspaceId: string) {
  const facts = await db
    .select({
      id: factDefinition.id,
      kind: factDefinition.kind,
      status: factDefinition.status,
    })
    .from(factDefinition)
    .where(eq(factDefinition.workspaceId, workspaceId));
  return new Map<string, ResolverFactView>(
    facts.map((f) => [f.id, { kind: f.kind, status: f.status }]),
  );
}

// Load the active reference table version for a data source in the workspace.
async function loadActiveTable(
  db: Database,
  workspaceId: string,
  dataSourceId: string,
) {
  const [src] = await db
    .select()
    .from(dataSource)
    .where(
      and(
        eq(dataSource.id, dataSourceId),
        eq(dataSource.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!src || src.kind !== 'reference_table') return null;
  const [active] = await db
    .select()
    .from(referenceTable)
    .where(
      and(
        eq(referenceTable.dataSourceId, dataSourceId),
        eq(referenceTable.status, 'active'),
      ),
    )
    .limit(1);
  return active ?? null;
}

// GET /api/workspaces/:workspaceId/resolvers — list (viewer+).
resolverRoutes.get('/api/workspaces/:workspaceId/resolvers', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;
  if (!canViewWorkspaceData(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
  }
  const rows = await db
    .select()
    .from(resolverRecipe)
    .where(eq(resolverRecipe.workspaceId, workspaceId))
    .orderBy(desc(resolverRecipe.createdAt));
  return c.json({ resolvers: rows.map(serializeResolver) });
});

// POST /api/workspaces/:workspaceId/resolvers — create (admin+).
resolverRoutes.post('/api/workspaces/:workspaceId/resolvers', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;
  if (!canManageDataSources(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
  }

  const body = (await c.req.json().catch(() => null)) as
    | (ResolverRecipeDraft & { dataSourceId?: unknown })
    | null;
  if (!body || typeof body !== 'object') {
    return jsonError(c, 400, 'invalid_body', 'Request body is required.');
  }
  if (typeof body.dataSourceId !== 'string') {
    return jsonError(
      c,
      400,
      'data_source_required',
      'dataSourceId is required.',
    );
  }

  const active = await loadActiveTable(db, workspaceId, body.dataSourceId);
  if (!active) {
    return jsonError(
      c,
      400,
      'invalid_data_source',
      'dataSourceId must reference a reference table with an active version.',
    );
  }

  const facts = await buildFactContext(db, workspaceId);
  const result = validateResolverRecipe(body, {
    facts,
    tableKeyColumns: active.keyColumns as string[],
    tableColumns: (active.columns as ColumnDef[]).map((col) => col.name),
  });
  if (!result.ok)
    return jsonError(c, 400, result.error.code, result.error.message);
  const recipe = result.value;

  const [created] = await db
    .insert(resolverRecipe)
    .values({
      workspaceId,
      name: recipe.name,
      inputFactIds: recipe.inputFactIds,
      dataSourceId: body.dataSourceId,
      operationRef: recipe.operationRef,
      parameterMappings: recipe.parameterMappings,
      outputMappings: recipe.outputMappings,
      normalizers: recipe.normalizers,
      fallbackPolicy: recipe.fallbackPolicy,
      status: 'active',
      createdActorType: 'user',
      createdActorId: access.user.id,
    })
    .returning();
  if (!created) {
    return jsonError(
      c,
      500,
      'resolver_create_failed',
      'Could not create resolver.',
    );
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'resolver.created',
    targetType: 'resolver_recipe',
    targetId: created.id,
    metadata: { name: recipe.name },
  });

  return c.json({ resolver: serializeResolver(created) }, 201);
});

// PATCH /api/resolvers/:resolverId — re-validate the full recipe (admin+).
resolverRoutes.patch('/api/resolvers/:resolverId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadResolverAccess(c, db, c.req.param('resolverId'));
  if ('error' in access) return access.error;
  if (!canManageDataSources(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
  }
  const existing = access.recipe;

  const body = (await c.req.json().catch(() => null)) as
    | (ResolverRecipeDraft & { status?: unknown })
    | null;
  if (!body || typeof body !== 'object') {
    return jsonError(c, 400, 'invalid_body', 'Request body is required.');
  }

  const active = await loadActiveTable(
    db,
    existing.workspaceId,
    existing.dataSourceId,
  );
  if (!active) {
    return jsonError(
      c,
      400,
      'invalid_data_source',
      'The resolver data source no longer has an active version.',
    );
  }
  const facts = await buildFactContext(db, existing.workspaceId);
  const result = validateResolverRecipe(body, {
    facts,
    tableKeyColumns: active.keyColumns as string[],
    tableColumns: (active.columns as ColumnDef[]).map((col) => col.name),
  });
  if (!result.ok)
    return jsonError(c, 400, result.error.code, result.error.message);
  const recipe = result.value;

  let status = existing.status;
  if (body.status !== undefined) {
    if (
      typeof body.status !== 'string' ||
      !['draft', 'active', 'disabled'].includes(body.status)
    ) {
      return jsonError(c, 400, 'invalid_status', 'status is invalid.');
    }
    status = body.status;
  }

  const [updated] = await db
    .update(resolverRecipe)
    .set({
      name: recipe.name,
      inputFactIds: recipe.inputFactIds,
      parameterMappings: recipe.parameterMappings,
      outputMappings: recipe.outputMappings,
      normalizers: recipe.normalizers,
      fallbackPolicy: recipe.fallbackPolicy,
      status,
      version: existing.version + 1,
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(eq(resolverRecipe.id, existing.id))
    .returning();

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: existing.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'resolver.updated',
    targetType: 'resolver_recipe',
    targetId: existing.id,
  });

  return c.json({ resolver: serializeResolver(updated ?? existing) });
});

// POST /api/resolvers/:resolverId/disable (admin+).
resolverRoutes.post('/api/resolvers/:resolverId/disable', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadResolverAccess(c, db, c.req.param('resolverId'));
  if ('error' in access) return access.error;
  if (!canManageDataSources(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
  }
  const existing = access.recipe;
  const [updated] = await db
    .update(resolverRecipe)
    .set({
      status: 'disabled',
      version: existing.version + 1,
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(eq(resolverRecipe.id, existing.id))
    .returning();
  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: existing.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'resolver.disabled',
    targetType: 'resolver_recipe',
    targetId: existing.id,
  });
  return c.json({ resolver: serializeResolver(updated ?? existing) });
});

// POST /api/resolvers/:resolverId/test — run the recipe against sample facts (viewer+).
resolverRoutes.post('/api/resolvers/:resolverId/test', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadResolverAccess(c, db, c.req.param('resolverId'));
  if ('error' in access) return access.error;
  if (!canViewWorkspaceData(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
  }
  const recipe = access.recipe;

  const active = await loadActiveTable(
    db,
    recipe.workspaceId,
    recipe.dataSourceId,
  );
  if (!active) {
    return jsonError(
      c,
      409,
      'no_active_version',
      'No active reference table version.',
    );
  }

  const body = (await c.req.json().catch(() => null)) as {
    facts?: Array<{ factId?: unknown; value?: unknown }>;
  } | null;
  const availableFacts = new Map<string, string>();
  if (Array.isArray(body?.facts)) {
    for (const f of body.facts) {
      if (typeof f.factId === 'string' && typeof f.value === 'string') {
        availableFacts.set(f.factId, f.value);
      }
    }
  }

  const outputMappings = recipe.outputMappings as OutputMapping[];
  const parameterKeyMappings = (
    recipe.parameterMappings as { keyColumns: KeyColumnMapping[] }
  ).keyColumns;

  const factIds = outputMappings.map((m) => m.factId);
  const factRows = factIds.length
    ? await db
        .select({
          id: factDefinition.id,
          type: factDefinition.type,
          enumValues: factDefinition.enumValues,
        })
        .from(factDefinition)
        .where(eq(factDefinition.workspaceId, recipe.workspaceId))
    : [];
  const factsById = new Map<string, FactView>(
    factRows
      .filter((f) => factIds.includes(f.id))
      .map((f) => [
        f.id,
        {
          id: f.id,
          type: f.type as FactView['type'],
          enumValues: (f.enumValues as string[] | null) ?? null,
        },
      ]),
  );

  const result = await resolveReferenceTableRecipe({
    recipeId: recipe.id,
    dataSourceId: recipe.dataSourceId,
    referenceTableId: active.id,
    referenceTableVersion: active.version,
    keyColumns: active.keyColumns as string[],
    parameterKeyMappings,
    outputMappings,
    availableFacts,
    factsById,
    fetchRowByHash: async (tableId, keyHash) => {
      const [row] = await db
        .select({ data: referenceTableRow.data })
        .from(referenceTableRow)
        .where(
          and(
            eq(referenceTableRow.referenceTableId, tableId),
            eq(referenceTableRow.keyHash, keyHash),
          ),
        )
        .limit(1);
      return row ? (row.data as Record<string, unknown>) : null;
    },
    now: new Date(),
  });

  return c.json(result);
});
