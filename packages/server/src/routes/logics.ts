import type { Logic } from '@leverie/engine';
import { validateLogicForSave } from '@leverie/engine';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  checkDataReadiness,
  type ReadinessFact,
  type ReadinessResolver,
} from '../dataWorkspace/dataReadiness.js';
import { buildDataSnapshot } from '../dataWorkspace/snapshot.js';
import { createDb, type Database } from '../db/client.js';
import {
  dataSource,
  factDefinition,
  invitation,
  logic,
  logicFactBinding,
  logicVersion,
  logicVersionDataSnapshot,
  membership,
  org,
  referenceTable,
  resolverRecipe,
  workspace,
} from '../db/schema.js';
import { sendInvitationEmail } from '../email.js';
import type { Env } from '../env.js';
import {
  type AppContext,
  assertSlug,
  canDeleteLogic,
  canEditLogics,
  enforceInvitationEmailRateLimit,
  fallbackSlug,
  jsonError,
  type MembershipAccess,
  normalizeSlug,
  parseBodyBoolean,
  parseBodyNumber,
  parseBodyObject,
  parseBodyString,
  type Role,
  type RouteError,
  randomToken,
  requireMembership,
  requireUser,
  rolePersona,
  sha256Base64Url,
  slugWithRandomSuffix,
  writeAudit,
} from './shared.js';

// Temporary anti-abuse cap while the editor is publicly open. Counts logics
// the user has created themselves (createdActorType = 'user'), across all
// workspaces, excluding soft-deleted rows.
const MAX_LOGICS_PER_USER = 3;

// Temporary cap on immutable logic_version rows per logic. Each publish copies
// the full draft_data jsonb into a new row (up to ~1 MB after the body limit),
// so unbounded publishing is a cheap Postgres-storage DoS. 10 is generous for
// a single logic's iteration history and can be raised once history pruning /
// quota enforcement lands.
const MAX_VERSIONS_PER_LOGIC = 10;

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
type WorkspaceConfigJson = Record<string, unknown>;
type SerializedLogicInput = Pick<
  LogicRow,
  | 'id'
  | 'workspaceId'
  | 'slug'
  | 'name'
  | 'description'
  | 'draftData'
  | 'draftWorkspaceConfig'
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
  logic_draft_workspace_config: WorkspaceConfigJson | null;
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

function parseWorkspaceConfigBody(c: AppContext, body: unknown) {
  if (!body || typeof body !== 'object' || !('workspaceConfig' in body)) {
    return { value: undefined as WorkspaceConfigJson | null | undefined };
  }

  const value = (body as Record<string, unknown>).workspaceConfig;
  if (value === null) return { value: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      error: jsonError(
        c,
        400,
        'invalid_workspace_config',
        'Workspace config must be an object or null.',
      ),
    };
  }

  const config = value as WorkspaceConfigJson;
  if (config.version !== '1') {
    return {
      error: jsonError(
        c,
        400,
        'invalid_workspace_config',
        'Workspace config version must be "1".',
      ),
    };
  }
  return { value: config };
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

// Gather the data-connected layer for a logic and run publish readiness. Shared
// by the readiness endpoint and the publish route. A logic with no bindings is
// treated as not data-connected (readiness passes, no snapshot is written),
// preserving existing publish behavior (§15).
type FactRow = typeof factDefinition.$inferSelect;
type ResolverRow = typeof resolverRecipe.$inferSelect;
type DataSourceRow = typeof dataSource.$inferSelect;
type ActiveTableRow = {
  dataSourceId: string;
  referenceTableId: string;
  version: number;
  rowCount: number;
  status: string;
};

interface LogicDataLayer {
  bindings: { fieldId: string; factId: string }[];
  facts: FactRow[];
  resolvers: ResolverRow[];
  dataSources: DataSourceRow[];
  activeTables: ActiveTableRow[];
}

function resolverOutputFactIds(resolver: ResolverRow): string[] {
  const mappings = (resolver.outputMappings as { factId?: string }[]) ?? [];
  return mappings
    .map((m) => m.factId)
    .filter((id): id is string => typeof id === 'string');
}

async function loadLogicDataLayer(
  db: Database,
  logicRow: { id: string; workspaceId: string },
): Promise<LogicDataLayer> {
  const [bindings, facts, resolvers, dataSources, tables] = await Promise.all([
    db
      .select({
        fieldId: logicFactBinding.fieldId,
        factId: logicFactBinding.factId,
      })
      .from(logicFactBinding)
      .where(eq(logicFactBinding.logicId, logicRow.id)),
    db
      .select()
      .from(factDefinition)
      .where(eq(factDefinition.workspaceId, logicRow.workspaceId)),
    db
      .select()
      .from(resolverRecipe)
      .where(eq(resolverRecipe.workspaceId, logicRow.workspaceId)),
    db
      .select()
      .from(dataSource)
      .where(eq(dataSource.workspaceId, logicRow.workspaceId)),
    db
      .select({
        dataSourceId: referenceTable.dataSourceId,
        referenceTableId: referenceTable.id,
        version: referenceTable.version,
        rowCount: referenceTable.rowCount,
        status: referenceTable.status,
      })
      .from(referenceTable)
      .where(
        and(
          eq(referenceTable.workspaceId, logicRow.workspaceId),
          eq(referenceTable.status, 'active'),
        ),
      ),
  ]);
  return { bindings, facts, resolvers, dataSources, activeTables: tables };
}

function runReadiness(logicData: Logic, layer: LogicDataLayer) {
  const facts: ReadinessFact[] = layer.facts.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    kind: f.kind,
    status: f.status,
    enumValues: (f.enumValues as string[] | null) ?? null,
    question: f.question,
    sensitive: f.sensitive,
    loggingPolicy: f.loggingPolicy,
  }));
  const resolvers: ReadinessResolver[] = layer.resolvers.map((r) => ({
    id: r.id,
    status: r.status,
    dataSourceId: r.dataSourceId,
    inputFactIds: (r.inputFactIds as string[]) ?? [],
    outputFactIds: resolverOutputFactIds(r),
  }));
  return checkDataReadiness({
    fieldDefs: logicData.fieldDefs ?? {},
    bindings: layer.bindings,
    facts,
    resolvers,
    dataSources: layer.dataSources.map((s) => ({ id: s.id, status: s.status })),
    referenceTables: layer.activeTables.map((t) => ({
      dataSourceId: t.dataSourceId,
      status: t.status,
      rowCount: t.rowCount,
    })),
  });
}

// Assemble the publish-time data snapshot from the gathered layer, restricting
// to the facts / resolvers / sources relevant to this logic's bindings.
async function buildLogicDataSnapshot(layer: LogicDataLayer) {
  const boundFactIds = new Set(layer.bindings.map((b) => b.factId));
  const relevantResolvers = layer.resolvers.filter(
    (r) =>
      r.status === 'active' &&
      resolverOutputFactIds(r).some((fid) => boundFactIds.has(fid)),
  );
  const relevantSourceIds = new Set(
    relevantResolvers.map((r) => r.dataSourceId),
  );
  // Facts to snapshot: those bound, plus any referenced by the relevant
  // resolvers (inputs/outputs), so historical sessions can render them.
  const neededFactIds = new Set(boundFactIds);
  for (const r of relevantResolvers) {
    for (const id of (r.inputFactIds as string[]) ?? []) neededFactIds.add(id);
    for (const id of resolverOutputFactIds(r)) neededFactIds.add(id);
  }
  const factDefinitions = layer.facts.filter((f) => neededFactIds.has(f.id));
  const dataSources = layer.dataSources.filter((s) =>
    relevantSourceIds.has(s.id),
  );
  const referenceTables = layer.activeTables
    .filter((t) => relevantSourceIds.has(t.dataSourceId))
    .map((t) => ({
      dataSourceId: t.dataSourceId,
      referenceTableId: t.referenceTableId,
      version: t.version,
    }));

  return buildDataSnapshot({
    bindings: layer.bindings,
    factDefinitions,
    resolverRecipes: relevantResolvers,
    dataSources,
    referenceTables,
  });
}

function serializeLogic(row: SerializedLogicInput) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    draftData: row.draftData,
    draftWorkspaceConfig: row.draftWorkspaceConfig,
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
    workspaceConfig: row.workspaceConfig,
  };
}

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function findAvailableLogicSlug(
  db: Database,
  workspaceId: string,
  base: string,
) {
  async function slugExists(slug: string) {
    const [row] = await db
      .select({ id: logic.id })
      .from(logic)
      .where(
        and(
          eq(logic.workspaceId, workspaceId),
          eq(logic.slug, slug),
          isNull(logic.deletedAt),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  if (!(await slugExists(base))) return base;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = slugWithRandomSuffix(base);
    if (!(await slugExists(candidate))) return candidate;
  }
  return fallbackSlug('logic');
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

async function versionByNumber(
  db: Database,
  logicId: string,
  versionNumber: number,
) {
  const [row] = await db
    .select(logicVersionSelect())
    .from(logicVersion)
    .where(
      and(
        eq(logicVersion.logicId, logicId),
        eq(logicVersion.versionNumber, versionNumber),
      ),
    )
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

function parseRunnerShareRole(value: string | undefined): Role | null {
  if (value === undefined) return 'runner';
  if (value === 'viewer' || value === 'runner') return value;
  return null;
}

function runnerPath(input: {
  workspaceId: string;
  logicId: string;
  versionNumber: number;
}) {
  return `/run/${input.workspaceId}/${input.logicId}@v${input.versionNumber}`;
}

function invitationUrl(c: AppContext, token: string, redirectPath?: string) {
  const url = new URL('/invite', c.env.BETTER_AUTH_URL);
  url.searchParams.set('token', token);
  if (redirectPath) url.searchParams.set('redirect', redirectPath);
  return url.toString();
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
    .select({
      logic,
      productionVersionNumber: logicVersion.versionNumber,
    })
    .from(logic)
    .leftJoin(logicVersion, eq(logic.productionVersionId, logicVersion.id))
    .where(and(eq(logic.workspaceId, workspaceId), isNull(logic.deletedAt)))
    .orderBy(desc(logic.draftUpdatedAt));

  return c.json({
    logics: rows.map((row) => ({
      ...serializeLogic(row.logic),
      productionVersionNumber: row.productionVersionNumber,
      // Per-row deletion right, so the list can show a delete affordance only
      // where this caller may actually remove it (own logics for editors; any
      // for admins/owners).
      canDelete: canDeleteLogic(access.member.role, row.logic, access.user.id),
    })),
  });
});

// Lists every logic the current user created, across all of their workspaces,
// with the cap usage. This backs the per-user logic cap surfaced in the logic
// list: the cap counts a user's own creations globally, so the usage shown must
// span workspaces too. Left joins keep a row even when its workspace/org was
// deleted or the user's membership was removed (those still count against the
// cap); canDelete then reflects whether this endpoint's caller may actually
// remove it.
logicRoutes.get('/api/me/logics', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const user = await requireUser(c, db);
  if (!user) return jsonError(c, 401, 'unauthorized', 'Sign in first.');

  const rows = await db
    .select({
      id: logic.id,
      name: logic.name,
      slug: logic.slug,
      workspaceId: logic.workspaceId,
      workspaceName: workspace.name,
      orgId: org.id,
      orgName: org.name,
      role: membership.role,
      productionVersionId: logic.productionVersionId,
      draftUpdatedAt: logic.draftUpdatedAt,
    })
    .from(logic)
    .leftJoin(workspace, eq(logic.workspaceId, workspace.id))
    .leftJoin(org, eq(workspace.orgId, org.id))
    .leftJoin(
      membership,
      and(
        eq(membership.orgId, org.id),
        eq(membership.userId, user.id),
        isNull(membership.removedAt),
      ),
    )
    .where(
      and(
        eq(logic.createdActorType, 'user'),
        eq(logic.createdActorId, user.id),
        isNull(logic.deletedAt),
      ),
    )
    .orderBy(desc(logic.draftUpdatedAt));

  return c.json({
    used: rows.length,
    limit: MAX_LOGICS_PER_USER,
    logics: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      orgId: row.orgId,
      orgName: row.orgName,
      productionVersionId: row.productionVersionId,
      draftUpdatedAt: row.draftUpdatedAt,
      canDelete: row.role
        ? canDeleteLogic(
            row.role as Role,
            { createdActorType: 'user', createdActorId: user.id },
            user.id,
          )
        : false,
    })),
  });
});

// Runner load. Accepts /run/<workspaceId>/<logicId> (production) and
// /run/<workspaceId>/<logicId>@vN (exact version) (§5.5). When the resolved
// version has a published data snapshot, the data-connected payload
// (factDefinitions, factBindings, dataSnapshot) is included; otherwise the
// response is the existing non-data-connected shape (§15).
logicRoutes.get('/api/run/:workspaceId/:logicRef', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const logicRef = c.req.param('logicRef');
  const match = logicRef.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:@v([1-9][0-9]*))?$/i,
  );
  if (!match?.[1]) {
    return jsonError(
      c,
      400,
      'invalid_runner_ref',
      'Use /run/<workspaceId>/<logicId> or /run/<workspaceId>/<logicId>@vN.',
    );
  }

  const logicId = match[1];
  const versionNumber = match[2] ? Number(match[2]) : null;
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access.error;

  const [logicRow] = await db
    .select()
    .from(logic)
    .where(
      and(
        eq(logic.workspaceId, workspaceId),
        eq(logic.id, logicId),
        isNull(logic.deletedAt),
      ),
    )
    .limit(1);
  if (!logicRow) {
    return jsonError(c, 404, 'not_found', 'Logic not found.');
  }

  let version: RunnerVersionRow | undefined;
  if (versionNumber === null) {
    if (!logicRow.productionVersionId) {
      return jsonError(
        c,
        404,
        'no_production',
        'This logic has no production version yet.',
      );
    }
    [version] = await db
      .select()
      .from(logicVersion)
      .where(eq(logicVersion.id, logicRow.productionVersionId))
      .limit(1);
  } else {
    [version] = await db
      .select()
      .from(logicVersion)
      .where(
        and(
          eq(logicVersion.logicId, logicId),
          eq(logicVersion.versionNumber, versionNumber),
        ),
      )
      .limit(1);
  }
  if (!version) {
    return jsonError(c, 404, 'not_found', 'Runner version not found.');
  }

  const [snapshot] = await db
    .select()
    .from(logicVersionDataSnapshot)
    .where(eq(logicVersionDataSnapshot.logicVersionId, version.id))
    .limit(1);

  return c.json({
    workspace: access.workspace,
    logic: serializeLogic(logicRow),
    version: serializeRunnerVersion(version),
    runner: {
      role: access.member.role,
      canEdit: canEditLogics(access.member.role),
    },
    dataConnected: Boolean(snapshot),
    factDefinitions: snapshot ? snapshot.factDefinitions : null,
    factBindings: snapshot ? snapshot.bindings : null,
    dataSnapshot: snapshot
      ? { id: snapshot.id, snapshotHash: snapshot.snapshotHash }
      : null,
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

  const [createdByUser] = await db
    .select({ value: count() })
    .from(logic)
    .where(
      and(
        eq(logic.createdActorType, 'user'),
        eq(logic.createdActorId, access.user.id),
        isNull(logic.deletedAt),
      ),
    );
  if ((createdByUser?.value ?? 0) >= MAX_LOGICS_PER_USER) {
    return jsonError(
      c,
      403,
      'logic_limit_reached',
      `Each account can create up to ${MAX_LOGICS_PER_USER} logics. Delete an existing logic to free a slot.`,
    );
  }

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { required: true, max: 120 });
  if (!name) return jsonError(c, 400, 'invalid_name', 'Name is required.');

  const data = parseBodyObject(body, 'data', true);
  if (!data)
    return jsonError(c, 400, 'invalid_data', 'Logic data is required.');

  const validation = validateLogicBody(c, data);
  if ('error' in validation) return validation.error;
  const workspaceConfig = parseWorkspaceConfigBody(c, body);
  if ('error' in workspaceConfig) return workspaceConfig.error;

  const requestedSlug = parseBodyString(body, 'slug', { max: 63 });
  const baseSlug = requestedSlug
    ? normalizeSlug(requestedSlug)
    : normalizeSlug(name) || fallbackSlug('logic');
  const slugError = assertSlug(c, baseSlug);
  if (slugError) return slugError;
  // Slugs PATCH-update only when a user passes one explicitly (see PATCH
  // handler), so renaming a logic in the UI does not change its slug. That
  // means a brand-new logic derived from the same name can collide with the
  // original slug of a since-renamed logic. When the caller did not pin a
  // slug, suffix to find an available one; when they did, surface a 409.
  const slug = requestedSlug
    ? baseSlug
    : await findAvailableLogicSlug(db, workspaceId, baseSlug);

  const description = parseBodyString(body, 'description', { max: 500 });
  let created: LogicRow | undefined;
  try {
    [created] = await db
      .insert(logic)
      .values({
        workspaceId,
        slug,
        name,
        description,
        draftData: validation.logic,
        draftWorkspaceConfig: workspaceConfig.value ?? null,
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
  } catch (error) {
    const maybeError = error as { code?: string; constraint?: string };
    if (
      maybeError.code === '23505' &&
      maybeError.constraint === 'logic_workspace_slug_active_uniq'
    ) {
      return jsonError(
        c,
        409,
        'slug_conflict',
        'A logic with this slug already exists in the workspace.',
      );
    }
    throw error;
  }

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
    logic: {
      ...serializeLogic(access.logic),
      // Lets the editor gate its delete affordance on the same rule the DELETE
      // route enforces, without a second round-trip.
      canDelete: canDeleteLogic(
        access.member.role,
        access.logic,
        access.user.id,
      ),
    },
    latestVersion: latest ?? null,
    productionVersion: production ?? null,
  });
});

logicRoutes.post('/api/logics/:logicId/runner-share', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = await c.req.json().catch(() => null);
  const versionNumber = parseBodyNumber(body, 'versionNumber');
  if (versionNumber === null || versionNumber === 0) {
    return jsonError(c, 400, 'invalid_version', 'Version number is invalid.');
  }

  const selectedVersion =
    versionNumber === undefined
      ? ((await productionVersion(db, access.logic)) ??
        (await latestVersion(db, logicId)))
      : await versionByNumber(db, logicId, versionNumber);

  if (!selectedVersion) {
    return jsonError(
      c,
      409,
      'no_published_version',
      'Publish this logic before sharing the runner.',
    );
  }

  const path = runnerPath({
    workspaceId: access.workspace.id,
    logicId: access.logic.id,
    versionNumber: selectedVersion.versionNumber,
  });
  const runnerUrl = new URL(path, c.env.BETTER_AUTH_URL).toString();

  const email = parseBodyString(body, 'email', { max: 320 });
  if (email === undefined) {
    return c.json({
      runnerUrl,
      runnerPath: path,
      version: selectedVersion,
    });
  }
  if (!email?.includes('@')) {
    return jsonError(c, 400, 'invalid_email', 'Valid email is required.');
  }

  const roleValue = parseBodyString(body, 'role');
  if (roleValue === null) {
    return jsonError(
      c,
      400,
      'invalid_role',
      'Runner shares can invite viewer or runner roles.',
    );
  }
  const role = parseRunnerShareRole(roleValue);
  if (!role) {
    return jsonError(
      c,
      400,
      'invalid_role',
      'Runner shares can invite viewer or runner roles.',
    );
  }

  const [targetOrg] = await db
    .select()
    .from(org)
    .where(eq(org.id, access.workspace.orgId))
    .limit(1);
  if (!targetOrg) return jsonError(c, 404, 'not_found', 'Org not found.');

  const normalizedEmail = email.toLowerCase();
  const rateLimitError = await enforceInvitationEmailRateLimit(c, {
    orgId: access.workspace.orgId,
    actorUserId: access.user.id,
    email: normalizedEmail,
  });
  if (rateLimitError) return rateLimitError;

  await db
    .update(invitation)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitation.orgId, access.workspace.orgId),
        eq(invitation.email, normalizedEmail),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
      ),
    );

  const token = randomToken();
  const tokenDigest = await sha256Base64Url(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [created] = await db
    .insert(invitation)
    .values({
      orgId: access.workspace.orgId,
      email: normalizedEmail,
      role,
      tokenDigest,
      expiresAt,
      invitedActorType: 'user',
      invitedActorId: access.user.id,
    })
    .returning({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    });

  if (!created) {
    return jsonError(
      c,
      500,
      'invitation_failed',
      'Could not create invitation.',
    );
  }

  const acceptUrl = invitationUrl(c, token, path);
  await sendInvitationEmail(
    {
      resendApiKey: c.env.RESEND_API_KEY,
      from: c.env.EMAIL_FROM,
    },
    {
      email: created.email,
      orgName: targetOrg.name,
      inviterName: access.user.name,
      role: created.role,
      url: acceptUrl,
      expiresAt,
    },
  );

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.workspace.id,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'runner_share.invitation_created',
    targetType: 'invitation',
    targetId: created.id,
    metadata: {
      email: created.email,
      role: created.role,
      logicId: access.logic.id,
      versionNumber: selectedVersion.versionNumber,
    },
  });

  return c.json(
    {
      invitation: created,
      acceptUrl,
      runnerUrl,
      runnerPath: path,
      version: selectedVersion,
    },
    201,
  );
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
  const workspaceConfig = parseWorkspaceConfigBody(c, body);
  if ('error' in workspaceConfig) return workspaceConfig.error;
  const hasWorkspaceConfigUpdate = workspaceConfig.value !== undefined;
  const hasDraftUpdate = draftData !== undefined || hasWorkspaceConfigUpdate;

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
  if (hasWorkspaceConfigUpdate) {
    update.draftWorkspaceConfig = workspaceConfig.value;
    update.draftRevision =
      update.draftRevision ?? access.logic.draftRevision + 1;
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
    if (expectedDraftRevision !== undefined && hasDraftUpdate) {
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
    action: hasDraftUpdate ? 'logic.draft_saved' : 'logic.updated',
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
  if (!canDeleteLogic(access.member.role, access.logic, access.user.id)) {
    return jsonError(
      c,
      403,
      'forbidden',
      'Admins and owners can delete any logic; editors can delete only logics they created.',
    );
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

// GET /api/logics/:logicId/data-readiness — publish readiness checklist for the
// data-connected layer (viewer+). The publish route enforces the same checks
// server-side; this endpoint is for the editor checklist (§7.6).
logicRoutes.get('/api/logics/:logicId/data-readiness', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;

  const layer = await loadLogicDataLayer(db, access.logic);
  const readiness = runReadiness(access.logic.draftData as Logic, layer);
  return c.json({ readiness });
});

logicRoutes.post('/api/logics/:logicId/publish', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const [versionCount] = await db
    .select({ value: count() })
    .from(logicVersion)
    .where(eq(logicVersion.logicId, logicId));
  if ((versionCount?.value ?? 0) >= MAX_VERSIONS_PER_LOGIC) {
    return jsonError(
      c,
      403,
      'version_limit_reached',
      `Each logic can hold up to ${MAX_VERSIONS_PER_LOGIC} published versions.`,
    );
  }

  const body = await c.req.json().catch(() => null);
  const releaseNotes = parseBodyString(body, 'releaseNotes', { max: 2000 });
  const pinProduction = parseBodyBoolean(body, 'pinProduction', true);
  const validation = validateLogicBody(c, access.logic.draftData);
  if ('error' in validation) return validation.error;
  const draftWorkspaceConfigJson =
    access.logic.draftWorkspaceConfig == null
      ? null
      : JSON.stringify(access.logic.draftWorkspaceConfig);

  // Data-connected publish readiness (§7.6). Enforced server-side: blocking
  // issues stop the publish. A logic with no fact bindings is not data-connected
  // and skips both the checks and the snapshot, preserving existing behavior.
  const dataLayer = await loadLogicDataLayer(db, access.logic);
  const readiness = runReadiness(validation.logic, dataLayer);
  if (readiness.dataConnected && !readiness.ok) {
    return c.json(
      {
        error: {
          code: 'data_readiness_failed',
          message:
            'Resolve the blocking data readiness issues before publishing.',
          issues: readiness.issues,
        },
      },
      422,
    );
  }
  const dataSnapshot = readiness.dataConnected
    ? await buildLogicDataSnapshot(dataLayer)
    : null;

  let created: SerializedVersion | undefined;
  let updatedLogic: SerializedLogicInput = access.logic;
  try {
    const result = await db.execute(sql`
      WITH lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(${logicId}, 0))
      ),
      next_version AS (
        SELECT coalesce(max(version_number), 0) + 1 AS version_number
        FROM logic_version, lock
        WHERE logic_id = ${logicId}
      ),
      inserted AS (
        INSERT INTO logic_version (
          workspace_id,
          logic_id,
          version_number,
          schema_version,
          data,
          workspace_config,
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
          ${draftWorkspaceConfigJson}::jsonb,
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
        logic_result.draft_workspace_config AS logic_draft_workspace_config,
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
      draftWorkspaceConfig: row.logic_draft_workspace_config,
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

  // Pin the data-layer snapshot for this published version (§3.7). Only for
  // data-connected logics; others have no snapshot and the runner falls back to
  // its existing non-data-connected behavior.
  if (dataSnapshot) {
    await db.insert(logicVersionDataSnapshot).values({
      workspaceId: created.workspaceId,
      logicId: created.logicId,
      logicVersionId: created.id,
      bindings: dataSnapshot.bindings,
      factDefinitions: dataSnapshot.factDefinitions,
      resolverRecipes: dataSnapshot.resolverRecipes,
      dataSources: dataSnapshot.dataSources,
      referenceTables: dataSnapshot.referenceTables,
      snapshotHash: dataSnapshot.snapshotHash,
    });
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.logic.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: pinProduction ? 'logic.published_to_production' : 'logic.published',
    targetType: 'logic_version',
    targetId: created.id,
    metadata: {
      logicId,
      versionNumber: created.versionNumber,
      dataSnapshotHash: dataSnapshot?.snapshotHash,
    },
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
