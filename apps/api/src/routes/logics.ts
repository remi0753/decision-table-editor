import type { Logic } from '@leverie/engine';
import { validateLogicForSave } from '@leverie/engine';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb, type Database } from '../db/client.js';
import { logic, logicVersion, workspace } from '../db/schema.js';
import type { Env } from '../env.js';
import {
  type AppContext,
  assertSlug,
  canEditLogics,
  fallbackSlug,
  jsonError,
  type MembershipAccess,
  normalizeSlug,
  parseBodyBoolean,
  parseBodyNumber,
  parseBodyObject,
  parseBodyString,
  type RouteError,
  requireMembership,
  rolePersona,
  writeAudit,
} from './shared.js';

type LogicSourceLabel = 'draft' | 'latest' | 'production' | `v${number}`;

type LogicDataSource =
  | {
      type: 'draft';
      label: 'draft';
      data: Logic;
      draftRevision: number;
      updatedAt: Date;
    }
  | {
      type: 'version';
      label: 'latest' | 'production' | `v${number}`;
      data: Logic;
      versionNumber: number;
      versionId: string;
      publishedAt: Date;
    };

type LogicRow = typeof logic.$inferSelect;
type WorkspaceRow = typeof workspace.$inferSelect;
type WorkspaceAccess = MembershipAccess & { workspace: WorkspaceRow };
type LogicAccess = WorkspaceAccess & { logic: LogicRow };
type RunnerVersionRow = typeof logicVersion.$inferSelect;
type SerializedLogicInput = Pick<
  LogicRow,
  | 'id'
  | 'workspaceId'
  | 'slug'
  | 'name'
  | 'description'
  | 'draftData'
  | 'draftSchemaVersion'
  | 'draftRevision'
  | 'productionVersionId'
  | 'draftUpdatedAt'
  | 'createdAt'
  | 'updatedAt'
>;
type SerializedVersion = {
  id: string;
  workspaceId: string;
  logicId: string;
  versionNumber: number;
  schemaVersion: string;
  releaseNotes: string | null;
  publishedAt: Date;
  publishedActorType: string;
  publishedActorId: string | null;
};
type PublishRow = {
  version_id: string;
  version_workspace_id: string;
  version_logic_id: string;
  version_number: number;
  version_schema_version: string;
  version_release_notes: string | null;
  version_published_at: Date;
  version_published_actor_type: string;
  version_published_actor_id: string | null;
  logic_id: string;
  logic_workspace_id: string;
  logic_slug: string;
  logic_name: string;
  logic_description: string | null;
  logic_draft_data: Logic;
  logic_draft_schema_version: string;
  logic_draft_revision: number;
  logic_production_version_id: string | null;
  logic_draft_updated_at: Date;
  logic_created_at: Date;
  logic_updated_at: Date;
};

type JsonDiffChange = {
  path: string[];
  type: 'added' | 'removed' | 'changed';
  before: unknown;
  after: unknown;
};

function validateLogicBody(c: AppContext, data: unknown) {
  const result = validateLogicForSave(data);
  if (result.ok) return { logic: result.logic };

  return {
    error: c.json(
      {
        error: {
          code: 'invalid_logic',
          message: 'Logic JSON failed validation.',
          details: result.errors,
        },
      },
      400,
    ),
  };
}

async function loadWorkspaceAccess(
  c: AppContext,
  db: Database,
  workspaceId: string,
): Promise<WorkspaceAccess | RouteError> {
  const [existing] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, workspaceId), isNull(workspace.deletedAt)))
    .limit(1);

  if (!existing) {
    return { error: jsonError(c, 404, 'not_found', 'Workspace not found.') };
  }

  const access = await requireMembership(c, db, existing.orgId);
  if ('error' in access) return access;

  return { workspace: existing, ...access };
}

async function loadLogicAccess(
  c: AppContext,
  db: Database,
  logicId: string,
): Promise<LogicAccess | RouteError> {
  const [row] = await db
    .select({
      logic,
      workspace,
    })
    .from(logic)
    .innerJoin(workspace, eq(logic.workspaceId, workspace.id))
    .where(
      and(
        eq(logic.id, logicId),
        isNull(logic.deletedAt),
        isNull(workspace.deletedAt),
      ),
    )
    .limit(1);

  if (!row)
    return { error: jsonError(c, 404, 'not_found', 'Logic not found.') };

  const access = await requireMembership(c, db, row.workspace.orgId);
  if ('error' in access) return access;

  return { logic: row.logic, workspace: row.workspace, ...access };
}

function serializeLogic(row: SerializedLogicInput) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    draftData: row.draftData,
    draftSchemaVersion: row.draftSchemaVersion,
    draftRevision: row.draftRevision,
    productionVersionId: row.productionVersionId,
    draftUpdatedAt: row.draftUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function logicVersionSelect() {
  return {
    id: logicVersion.id,
    workspaceId: logicVersion.workspaceId,
    logicId: logicVersion.logicId,
    versionNumber: logicVersion.versionNumber,
    schemaVersion: logicVersion.schemaVersion,
    releaseNotes: logicVersion.releaseNotes,
    publishedAt: logicVersion.publishedAt,
    publishedActorType: logicVersion.publishedActorType,
    publishedActorId: logicVersion.publishedActorId,
  };
}

function serializeRunnerVersion(row: RunnerVersionRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    logicId: row.logicId,
    versionNumber: row.versionNumber,
    schemaVersion: row.schemaVersion,
    releaseNotes: row.releaseNotes,
    publishedAt: row.publishedAt,
    publishedActorType: row.publishedActorType,
    publishedActorId: row.publishedActorId,
    data: row.data,
  };
}

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function latestVersion(db: Database, logicId: string) {
  const [row] = await db
    .select(logicVersionSelect())
    .from(logicVersion)
    .where(eq(logicVersion.logicId, logicId))
    .orderBy(desc(logicVersion.versionNumber))
    .limit(1);

  return row;
}

async function productionVersion(db: Database, existing: LogicRow) {
  if (!existing.productionVersionId) return undefined;

  const [row] = await db
    .select(logicVersionSelect())
    .from(logicVersion)
    .where(eq(logicVersion.id, existing.productionVersionId))
    .limit(1);

  return row;
}

function parseLogicSource(
  input: string | undefined,
  defaultLabel: LogicSourceLabel,
) {
  const label = input ?? defaultLabel;
  if (label === 'draft' || label === 'latest' || label === 'production') {
    return label;
  }
  if (/^v[1-9][0-9]*$/.test(label)) return label as `v${number}`;
  return null;
}

async function resolveLogicDataSource(
  db: Database,
  existing: LogicRow,
  label: LogicSourceLabel,
): Promise<LogicDataSource | null> {
  if (label === 'draft') {
    return {
      type: 'draft',
      label,
      data: existing.draftData as Logic,
      draftRevision: existing.draftRevision,
      updatedAt: existing.draftUpdatedAt,
    };
  }

  if (label === 'production' && !existing.productionVersionId) return null;

  const where =
    label === 'production'
      ? eq(logicVersion.id, existing.productionVersionId as string)
      : label === 'latest'
        ? eq(logicVersion.logicId, existing.id)
        : and(
            eq(logicVersion.logicId, existing.id),
            eq(logicVersion.versionNumber, Number(label.slice(1))),
          );

  const [row] = await db
    .select()
    .from(logicVersion)
    .where(where)
    .orderBy(desc(logicVersion.versionNumber))
    .limit(1);

  if (!row) return null;

  return {
    type: 'version',
    label,
    data: row.data as Logic,
    versionNumber: row.versionNumber,
    versionId: row.id,
    publishedAt: row.publishedAt,
  };
}

function diffJson(
  before: unknown,
  after: unknown,
  path: string[] = [],
): JsonDiffChange[] {
  if (Object.is(before, after)) return [];

  const beforeIsObject =
    before !== null && typeof before === 'object' && !Array.isArray(before);
  const afterIsObject =
    after !== null && typeof after === 'object' && !Array.isArray(after);

  if (!beforeIsObject || !afterIsObject) {
    return [
      {
        path,
        type:
          before === undefined
            ? 'added'
            : after === undefined
              ? 'removed'
              : 'changed',
        before,
        after,
      },
    ];
  }

  const keys = new Set([
    ...Object.keys(before as Record<string, unknown>),
    ...Object.keys(after as Record<string, unknown>),
  ]);
  return Array.from(keys).flatMap((key) =>
    diffJson(
      (before as Record<string, unknown>)[key],
      (after as Record<string, unknown>)[key],
      [...path, key],
    ),
  );
}

export const logicRoutes = new Hono<{ Bindings: Env }>();

logicRoutes.get('/api/workspaces/:workspaceId/logics', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;

  const rows = await db
    .select()
    .from(logic)
    .where(and(eq(logic.workspaceId, workspaceId), isNull(logic.deletedAt)))
    .orderBy(desc(logic.draftUpdatedAt));

  return c.json({ logics: rows.map(serializeLogic) });
});

logicRoutes.get('/api/run/:workspaceId/:logicRef', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const logicRef = c.req.param('logicRef');
  const match = logicRef.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@v([1-9][0-9]*)$/i,
  );
  if (!match) {
    return jsonError(
      c,
      400,
      'invalid_runner_ref',
      'Use /run/<workspaceId>/<logicId>@vN.',
    );
  }

  const logicId = match[1] as string;
  const versionNumber = Number(match[2]);
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;

  const [row] = await db
    .select({
      logic,
      version: logicVersion,
    })
    .from(logicVersion)
    .innerJoin(logic, eq(logicVersion.logicId, logic.id))
    .where(
      and(
        eq(logic.workspaceId, workspaceId),
        eq(logic.id, logicId),
        eq(logicVersion.versionNumber, versionNumber),
        isNull(logic.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return jsonError(c, 404, 'not_found', 'Runner version not found.');
  }

  return c.json({
    workspace: access.workspace,
    logic: serializeLogic(row.logic),
    version: serializeRunnerVersion(row.version),
    runner: {
      role: access.member.role,
      canEdit: canEditLogics(access.member.role),
    },
  });
});

logicRoutes.post('/api/workspaces/:workspaceId/logics', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { required: true, max: 120 });
  if (!name) return jsonError(c, 400, 'invalid_name', 'Name is required.');

  const data = parseBodyObject(body, 'data', true);
  if (!data)
    return jsonError(c, 400, 'invalid_data', 'Logic data is required.');

  const validation = validateLogicBody(c, data);
  if ('error' in validation) return validation.error;

  const requestedSlug = parseBodyString(body, 'slug', { max: 63 });
  const slug = requestedSlug
    ? normalizeSlug(requestedSlug)
    : normalizeSlug(name) || fallbackSlug('logic');
  const slugError = assertSlug(c, slug);
  if (slugError) return slugError;

  const description = parseBodyString(body, 'description', { max: 500 });
  const [created] = await db
    .insert(logic)
    .values({
      workspaceId,
      slug,
      name,
      description,
      draftData: validation.logic,
      draftSchemaVersion: validation.logic.version,
      draftRevision: 1,
      draftUpdatedActorType: 'user',
      draftUpdatedActorId: access.user.id,
      createdActorType: 'user',
      createdActorId: access.user.id,
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .returning();

  if (!created) {
    return jsonError(c, 500, 'logic_create_failed', 'Could not create logic.');
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'logic.created',
    targetType: 'logic',
    targetId: created.id,
  });

  return c.json({ logic: serializeLogic(created) }, 201);
});

logicRoutes.get('/api/logics/:logicId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;

  const [latest, production] = await Promise.all([
    latestVersion(db, logicId),
    productionVersion(db, access.logic),
  ]);

  return c.json({
    logic: serializeLogic(access.logic),
    latestVersion: latest ?? null,
    productionVersion: production ?? null,
  });
});

logicRoutes.patch('/api/logics/:logicId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = await c.req.json().catch(() => null);
  const expectedDraftRevision = parseBodyNumber(body, 'draftRevision');
  if (expectedDraftRevision === null) {
    return jsonError(c, 400, 'invalid_revision', 'draftRevision is invalid.');
  }
  if (
    expectedDraftRevision !== undefined &&
    expectedDraftRevision !== access.logic.draftRevision
  ) {
    return jsonError(
      c,
      409,
      'draft_revision_conflict',
      'Draft has changed since it was loaded.',
    );
  }

  const update: Partial<typeof logic.$inferInsert> = {
    updatedActorType: 'user',
    updatedActorId: access.user.id,
  };

  const name = parseBodyString(body, 'name', { max: 120 });
  const slugInput = parseBodyString(body, 'slug', { max: 63 });
  const description = parseBodyString(body, 'description', { max: 500 });
  const draftData = parseBodyObject(body, 'data');

  if (name) update.name = name;
  if (description !== undefined) update.description = description ?? null;
  if (slugInput) {
    const slug = normalizeSlug(slugInput);
    const slugError = assertSlug(c, slug);
    if (slugError) return slugError;
    update.slug = slug;
  }
  if (draftData !== undefined) {
    if (!draftData) {
      return jsonError(c, 400, 'invalid_data', 'Logic data is invalid.');
    }
    const validation = validateLogicBody(c, draftData);
    if ('error' in validation) return validation.error;

    update.draftData = validation.logic;
    update.draftSchemaVersion = validation.logic.version;
    update.draftRevision = access.logic.draftRevision + 1;
    update.draftUpdatedAt = new Date();
    update.draftUpdatedActorType = 'user';
    update.draftUpdatedActorId = access.user.id;
  }

  const [updated] = await db
    .update(logic)
    .set(update)
    .where(
      and(
        eq(logic.id, logicId),
        isNull(logic.deletedAt),
        expectedDraftRevision === undefined
          ? undefined
          : eq(logic.draftRevision, expectedDraftRevision),
      ),
    )
    .returning();

  if (!updated) {
    if (expectedDraftRevision !== undefined && draftData !== undefined) {
      return jsonError(
        c,
        409,
        'draft_revision_conflict',
        'Draft has changed since it was loaded.',
      );
    }
    return jsonError(c, 404, 'not_found', 'Logic not found.');
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.logic.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: draftData === undefined ? 'logic.updated' : 'logic.draft_saved',
    targetType: 'logic',
    targetId: logicId,
    metadata: { draftRevision: updated.draftRevision },
  });

  return c.json({ logic: serializeLogic(updated) });
});

logicRoutes.delete('/api/logics/:logicId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const [deleted] = await db
    .update(logic)
    .set({
      deletedAt: new Date(),
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(and(eq(logic.id, logicId), isNull(logic.deletedAt)))
    .returning();

  if (!deleted) return jsonError(c, 404, 'not_found', 'Logic not found.');

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.logic.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'logic.deleted',
    targetType: 'logic',
    targetId: logicId,
  });

  return c.json({ logic: serializeLogic(deleted) });
});

logicRoutes.get('/api/logics/:logicId/versions', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;

  const rows = await db
    .select(logicVersionSelect())
    .from(logicVersion)
    .where(eq(logicVersion.logicId, logicId))
    .orderBy(desc(logicVersion.versionNumber));

  return c.json({ versions: rows });
});

logicRoutes.get('/api/logics/:logicId/versions/:versionNumber', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const versionNumber = Number(c.req.param('versionNumber'));
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return jsonError(c, 400, 'invalid_version', 'Version number is invalid.');
  }

  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;

  const [version] = await db
    .select()
    .from(logicVersion)
    .where(
      and(
        eq(logicVersion.logicId, logicId),
        eq(logicVersion.versionNumber, versionNumber),
      ),
    )
    .limit(1);

  if (!version) return jsonError(c, 404, 'not_found', 'Version not found.');

  return c.json({ version });
});

logicRoutes.post('/api/logics/:logicId/publish', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = await c.req.json().catch(() => null);
  const releaseNotes = parseBodyString(body, 'releaseNotes', { max: 2000 });
  const pinProduction = parseBodyBoolean(body, 'pinProduction', true);
  const validation = validateLogicBody(c, access.logic.draftData);
  if ('error' in validation) return validation.error;

  let created: SerializedVersion | undefined;
  let updatedLogic: SerializedLogicInput = access.logic;
  try {
    const result = await db.execute(sql`
      WITH lock AS (
        SELECT pg_advisory_xact_lock(hashtextextended(${logicId}, 0))
      ),
      next_version AS (
        SELECT coalesce(max(version_number), 0) + 1 AS version_number
        FROM logic_version
        WHERE logic_id = ${logicId}
      ),
      inserted AS (
        INSERT INTO logic_version (
          workspace_id,
          logic_id,
          version_number,
          schema_version,
          data,
          release_notes,
          published_actor_type,
          published_actor_id
        )
        SELECT
          ${access.logic.workspaceId}::uuid,
          ${logicId}::uuid,
          next_version.version_number,
          ${validation.logic.version},
          ${JSON.stringify(validation.logic)}::jsonb,
          ${releaseNotes ?? null},
          'user',
          ${access.user.id}::uuid
        FROM next_version, lock
        RETURNING *
      ),
      updated AS (
        UPDATE logic
        SET
          production_version_id = inserted.id,
          updated_actor_type = 'user',
          updated_actor_id = ${access.user.id}::uuid
        FROM inserted
        WHERE ${pinProduction}::boolean
          AND logic.id = ${logicId}::uuid
        RETURNING logic.*
      ),
      logic_result AS (
        SELECT * FROM updated
        UNION ALL
        SELECT logic.*
        FROM logic, inserted
        WHERE NOT ${pinProduction}::boolean
          AND logic.id = ${logicId}::uuid
      )
      SELECT
        inserted.id AS version_id,
        inserted.workspace_id AS version_workspace_id,
        inserted.logic_id AS version_logic_id,
        inserted.version_number AS version_number,
        inserted.schema_version AS version_schema_version,
        inserted.release_notes AS version_release_notes,
        inserted.published_at AS version_published_at,
        inserted.published_actor_type AS version_published_actor_type,
        inserted.published_actor_id AS version_published_actor_id,
        logic_result.id AS logic_id,
        logic_result.workspace_id AS logic_workspace_id,
        logic_result.slug AS logic_slug,
        logic_result.name AS logic_name,
        logic_result.description AS logic_description,
        logic_result.draft_data AS logic_draft_data,
        logic_result.draft_schema_version AS logic_draft_schema_version,
        logic_result.draft_revision AS logic_draft_revision,
        logic_result.production_version_id AS logic_production_version_id,
        logic_result.draft_updated_at AS logic_draft_updated_at,
        logic_result.created_at AS logic_created_at,
        logic_result.updated_at AS logic_updated_at
      FROM inserted
      JOIN logic_result ON true
    `);
    const [row] = rowsFromExecute<PublishRow>(result);
    if (!row) {
      return jsonError(c, 500, 'publish_failed', 'Could not publish version.');
    }

    created = {
      id: row.version_id,
      workspaceId: row.version_workspace_id,
      logicId: row.version_logic_id,
      versionNumber: row.version_number,
      schemaVersion: row.version_schema_version,
      releaseNotes: row.version_release_notes,
      publishedAt: row.version_published_at,
      publishedActorType: row.version_published_actor_type,
      publishedActorId: row.version_published_actor_id,
    };
    updatedLogic = {
      id: row.logic_id,
      workspaceId: row.logic_workspace_id,
      slug: row.logic_slug,
      name: row.logic_name,
      description: row.logic_description,
      draftData: row.logic_draft_data,
      draftSchemaVersion: row.logic_draft_schema_version,
      draftRevision: row.logic_draft_revision,
      productionVersionId: row.logic_production_version_id,
      draftUpdatedAt: row.logic_draft_updated_at,
      createdAt: row.logic_created_at,
      updatedAt: row.logic_updated_at,
    };
  } catch (error) {
    const maybeError = error as { code?: string; constraint?: string };
    if (
      maybeError.code === '23505' &&
      maybeError.constraint === 'logic_version_logic_number_uniq'
    ) {
      return jsonError(
        c,
        409,
        'publish_conflict',
        'A new version was published at the same time. Try again.',
      );
    }
    throw error;
  }
  if (!created) {
    return jsonError(c, 500, 'publish_failed', 'Could not publish version.');
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.logic.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: pinProduction ? 'logic.published_to_production' : 'logic.published',
    targetType: 'logic_version',
    targetId: created.id,
    metadata: { logicId, versionNumber: created.versionNumber },
  });

  return c.json(
    {
      logic: serializeLogic(updatedLogic),
      version: created,
    },
    201,
  );
});

logicRoutes.post('/api/logics/:logicId/production', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = await c.req.json().catch(() => null);
  const versionNumber = parseBodyNumber(body, 'versionNumber', true);
  if (!versionNumber || versionNumber < 1) {
    return jsonError(c, 400, 'invalid_version', 'Version number is required.');
  }

  const [target] = await db
    .select()
    .from(logicVersion)
    .where(
      and(
        eq(logicVersion.logicId, logicId),
        eq(logicVersion.versionNumber, versionNumber),
      ),
    )
    .limit(1);

  if (!target) return jsonError(c, 404, 'not_found', 'Version not found.');

  const [updated] = await db
    .update(logic)
    .set({
      productionVersionId: target.id,
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(eq(logic.id, logicId))
    .returning();

  if (!updated) return jsonError(c, 404, 'not_found', 'Logic not found.');

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.logic.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'logic.production_pinned',
    targetType: 'logic_version',
    targetId: target.id,
    metadata: { logicId, versionNumber },
  });

  return c.json({ logic: serializeLogic(updated), productionVersion: target });
});

logicRoutes.get('/api/logics/:logicId/diff', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;

  const fromLabel = parseLogicSource(c.req.query('from'), 'production');
  const toLabel = parseLogicSource(c.req.query('to'), 'draft');
  if (!fromLabel || !toLabel) {
    return jsonError(
      c,
      400,
      'invalid_diff_source',
      'Use draft, production, latest, or vN.',
    );
  }

  const [from, to] = await Promise.all([
    resolveLogicDataSource(db, access.logic, fromLabel),
    resolveLogicDataSource(db, access.logic, toLabel),
  ]);
  if (!from || !to) {
    return jsonError(c, 404, 'not_found', 'Diff source not found.');
  }

  const changes = diffJson(from.data, to.data);
  return c.json({
    from,
    to,
    equal: changes.length === 0,
    changes,
  });
});
