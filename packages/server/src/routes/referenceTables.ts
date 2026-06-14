import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { parseCsv } from '../dataWorkspace/csv.js';
import {
  buildReferenceTable,
  type ColumnDef,
  MAX_REFERENCE_FILE_BYTES,
  type ReferenceRowRecord,
  type ReferenceUploadMetadata,
} from '../dataWorkspace/referenceTableBuild.js';
import { createDb, type Database } from '../db/client.js';
import {
  dataSource,
  factDefinition,
  referenceTable,
  referenceTableRow,
  workspace,
} from '../db/schema.js';
import type { Env } from '../env.js';
import { buildLookupKeyHash, projectRow } from '../resolvers/referenceTable.js';
import type { FactView, OutputMapping } from '../resolvers/types.js';
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

export const referenceTableRoutes = new Hono<{ Bindings: Env }>();

type DataSourceRow = typeof dataSource.$inferSelect;
type ReferenceTableRow = typeof referenceTable.$inferSelect;

function serializeReferenceTable(
  source: DataSourceRow,
  active: ReferenceTableRow | null,
) {
  return {
    id: source.id,
    workspaceId: source.workspaceId,
    name: source.name,
    kind: source.kind,
    status: source.status,
    ownerUserId: source.ownerUserId,
    activeVersion: active
      ? {
          referenceTableId: active.id,
          version: active.version,
          rowCount: active.rowCount,
          columns: active.columns as ColumnDef[],
          keyColumns: active.keyColumns as string[],
          status: active.status,
          updatedAt: active.updatedAt,
        }
      : null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

type DataSourceAccess = WorkspaceAccess & { source: DataSourceRow };

async function loadDataSourceAccess(
  c: AppContext,
  db: Database,
  sourceId: string,
): Promise<DataSourceAccess | RouteError> {
  const [row] = await db
    .select({ source: dataSource, workspace })
    .from(dataSource)
    .innerJoin(workspace, eq(dataSource.workspaceId, workspace.id))
    .where(eq(dataSource.id, sourceId))
    .limit(1);
  if (!row)
    return {
      error: jsonError(c, 404, 'not_found', 'Reference table not found.'),
    };

  const access = await requireMembership(c, db, row.workspace.orgId);
  if ('error' in access) return access;
  if (row.source.kind !== 'reference_table') {
    return {
      error: jsonError(c, 400, 'not_reference_table', 'Not a reference table.'),
    };
  }
  return { source: row.source, workspace: row.workspace, ...access };
}

function insertRows(
  db: Database,
  referenceTableId: string,
  rows: ReferenceRowRecord[],
) {
  return db.insert(referenceTableRow).values(
    rows.map((r) => ({
      referenceTableId,
      rowIndex: r.rowIndex,
      keyHash: r.keyHash,
      keyValues: r.keyValues,
      data: r.data,
    })),
  );
}

async function getActiveVersion(db: Database, sourceId: string) {
  const [row] = await db
    .select()
    .from(referenceTable)
    .where(
      and(
        eq(referenceTable.dataSourceId, sourceId),
        eq(referenceTable.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}

interface ParsedUpload {
  csvText: string;
  metadata: {
    name?: string;
    headerRowIndex?: number;
  } & ReferenceUploadMetadata;
}

// Read the multipart body: a `file` part (CSV) and a `metadata` JSON part.
async function parseUpload(
  c: AppContext,
): Promise<
  | { ok: true; value: ParsedUpload }
  | { ok: false; status: 400 | 413; code: string; message: string }
> {
  const body = await c.req.parseBody().catch(() => null);
  if (!body) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_body',
      message: 'Expected multipart/form-data.',
    };
  }
  const file = body.file;
  if (!(file instanceof File)) {
    return {
      ok: false,
      status: 400,
      code: 'file_required',
      message: 'A CSV file is required in the "file" field.',
    };
  }
  if (file.size > MAX_REFERENCE_FILE_BYTES) {
    return {
      ok: false,
      status: 413,
      code: 'file_too_large',
      message: 'CSV file exceeds the 5 MB limit.',
    };
  }
  const metaRaw = body.metadata;
  if (typeof metaRaw !== 'string') {
    return {
      ok: false,
      status: 400,
      code: 'metadata_required',
      message: 'A JSON "metadata" field is required.',
    };
  }
  let metadata: ParsedUpload['metadata'];
  try {
    metadata = JSON.parse(metaRaw);
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'invalid_metadata',
      message: 'metadata is not valid JSON.',
    };
  }
  const csvText = await file.text();
  return { ok: true, value: { csvText, metadata } };
}

async function activeFactIdSet(db: Database, workspaceId: string) {
  const facts = await db
    .select({ id: factDefinition.id, status: factDefinition.status })
    .from(factDefinition)
    .where(eq(factDefinition.workspaceId, workspaceId));
  return new Set(facts.filter((f) => f.status === 'active').map((f) => f.id));
}

// GET /api/workspaces/:workspaceId/reference-tables — list (viewer+).
referenceTableRoutes.get(
  '/api/workspaces/:workspaceId/reference-tables',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const workspaceId = c.req.param('workspaceId');
    const access = await loadWorkspaceAccess(c, db, workspaceId);
    if ('error' in access) return access.error;
    if (!canViewWorkspaceData(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
    }

    const sources = await db
      .select()
      .from(dataSource)
      .where(
        and(
          eq(dataSource.workspaceId, workspaceId),
          eq(dataSource.kind, 'reference_table'),
        ),
      )
      .orderBy(desc(dataSource.createdAt));

    const result = [];
    for (const source of sources) {
      const active = await getActiveVersion(db, source.id);
      result.push(serializeReferenceTable(source, active));
    }
    return c.json({ referenceTables: result });
  },
);

// POST /api/workspaces/:workspaceId/reference-tables — create source + v1 (admin+).
referenceTableRoutes.post(
  '/api/workspaces/:workspaceId/reference-tables',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const workspaceId = c.req.param('workspaceId');
    const access = await loadWorkspaceAccess(c, db, workspaceId);
    if ('error' in access) return access.error;
    if (!canManageDataSources(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
    }

    const upload = await parseUpload(c);
    if (!upload.ok)
      return jsonError(c, upload.status, upload.code, upload.message);
    const { csvText, metadata } = upload.value;
    const name = (metadata.name ?? '').trim();
    if (!name || name.length > 120) {
      return jsonError(
        c,
        400,
        'invalid_name',
        'A table name (max 120) is required.',
      );
    }

    const parsed = parseCsv(csvText, metadata.headerRowIndex ?? 0);
    if (!parsed.ok)
      return jsonError(c, 400, parsed.error.code, parsed.error.message);

    const activeFacts = await activeFactIdSet(db, workspaceId);
    const built = await buildReferenceTable(parsed.data, metadata, activeFacts);
    if (!built.ok)
      return jsonError(c, 400, built.error.code, built.error.message);

    const sourceId = crypto.randomUUID();
    const tableId = crypto.randomUUID();

    const insertSource = db.insert(dataSource).values({
      id: sourceId,
      workspaceId,
      name,
      kind: 'reference_table',
      schema: {},
      ownerUserId: access.user.id,
      status: 'active',
      createdActorType: 'user',
      createdActorId: access.user.id,
    });
    const insertTable = db.insert(referenceTable).values({
      id: tableId,
      workspaceId,
      dataSourceId: sourceId,
      name,
      columns: built.value.columns,
      keyColumns: built.value.keyColumns,
      rowCount: built.value.rowCount,
      version: 1,
      status: 'active',
      createdActorType: 'user',
      createdActorId: access.user.id,
    });

    if (built.value.rows.length > 0) {
      await db.batch([
        insertSource,
        insertTable,
        insertRows(db, tableId, built.value.rows),
      ]);
    } else {
      await db.batch([insertSource, insertTable]);
    }

    await writeAudit(db, {
      orgId: access.workspace.orgId,
      workspaceId,
      actorUserId: access.user.id,
      actorPersona: rolePersona[access.member.role],
      action: 'reference_table.created',
      targetType: 'data_source',
      targetId: sourceId,
      metadata: { name, rowCount: built.value.rowCount },
    });

    const [source] = await db
      .select()
      .from(dataSource)
      .where(eq(dataSource.id, sourceId))
      .limit(1);
    if (!source) {
      return jsonError(
        c,
        500,
        'create_failed',
        'Could not create reference table.',
      );
    }
    const active = await getActiveVersion(db, sourceId);
    return c.json(
      { referenceTable: serializeReferenceTable(source, active) },
      201,
    );
  },
);

// Shared replace/append handler: creates a new version and supersedes the old.
async function createNewVersion(
  c: AppContext,
  db: Database,
  access: DataSourceAccess,
  mode: 'replace' | 'append',
) {
  const active = await getActiveVersion(db, access.source.id);
  const upload = await parseUpload(c);
  if (!upload.ok)
    return jsonError(c, upload.status, upload.code, upload.message);
  const { csvText, metadata } = upload.value;

  // append/replace reuse the active version's key columns + column mappings;
  // the operator only supplies new rows. For append the prior rows are merged.
  let effectiveMeta: ReferenceUploadMetadata;
  if (active) {
    const cols = active.columns as ColumnDef[];
    effectiveMeta = {
      keyColumns: active.keyColumns as string[],
      columnMappings: cols
        .filter((col) => col.factId)
        .map((col) => ({
          columnName: col.name,
          factId: col.factId as string,
          normalizer: col.normalizer,
        })),
    };
  } else if (mode === 'append') {
    return jsonError(
      c,
      409,
      'no_active_version',
      'No active version to append to.',
    );
  } else {
    effectiveMeta = {
      keyColumns: metadata.keyColumns,
      columnMappings: metadata.columnMappings,
    };
  }

  const parsed = parseCsv(csvText, metadata.headerRowIndex ?? 0);
  if (!parsed.ok)
    return jsonError(c, 400, parsed.error.code, parsed.error.message);

  // For append, merge the prior rows ahead of the new ones so duplicate keys
  // are detected across both sets.
  let mergedRows = parsed.data.rows;
  if (mode === 'append' && active) {
    const priorRows = await db
      .select({ data: referenceTableRow.data })
      .from(referenceTableRow)
      .where(eq(referenceTableRow.referenceTableId, active.id))
      .orderBy(referenceTableRow.rowIndex);
    mergedRows = [
      ...priorRows.map((r) => r.data as Record<string, string>),
      ...parsed.data.rows,
    ];
  }

  const activeFacts = await activeFactIdSet(db, access.source.workspaceId);
  const built = await buildReferenceTable(
    { headers: parsed.data.headers, rows: mergedRows },
    effectiveMeta,
    activeFacts,
  );
  if (!built.ok)
    return jsonError(c, 400, built.error.code, built.error.message);

  const tableId = crypto.randomUUID();
  const nextVersion = (active?.version ?? 0) + 1;

  const supersede = db
    .update(referenceTable)
    .set({ status: 'superseded' })
    .where(
      and(
        eq(referenceTable.dataSourceId, access.source.id),
        eq(referenceTable.status, 'active'),
      ),
    );
  const insertTable = db.insert(referenceTable).values({
    id: tableId,
    workspaceId: access.source.workspaceId,
    dataSourceId: access.source.id,
    name: access.source.name,
    columns: built.value.columns,
    keyColumns: built.value.keyColumns,
    rowCount: built.value.rowCount,
    version: nextVersion,
    status: 'active',
    createdActorType: 'user',
    createdActorId: access.user.id,
  });
  if (built.value.rows.length > 0) {
    await db.batch([
      supersede,
      insertTable,
      insertRows(db, tableId, built.value.rows),
    ]);
  } else {
    await db.batch([supersede, insertTable]);
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.source.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: `reference_table.${mode === 'append' ? 'appended' : 'replaced'}`,
    targetType: 'data_source',
    targetId: access.source.id,
    metadata: { version: nextVersion, rowCount: built.value.rowCount },
  });

  const [source] = await db
    .select()
    .from(dataSource)
    .where(eq(dataSource.id, access.source.id))
    .limit(1);
  if (!source) {
    return jsonError(
      c,
      500,
      'update_failed',
      'Could not update reference table.',
    );
  }
  const newActive = await getActiveVersion(db, access.source.id);
  return c.json({ referenceTable: serializeReferenceTable(source, newActive) });
}

// GET /api/reference-tables/:referenceTableId — active version + history (viewer+).
referenceTableRoutes.get(
  '/api/reference-tables/:referenceTableId',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadDataSourceAccess(
      c,
      db,
      c.req.param('referenceTableId'),
    );
    if ('error' in access) return access.error;
    if (!canViewWorkspaceData(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
    }
    const versions = await db
      .select()
      .from(referenceTable)
      .where(eq(referenceTable.dataSourceId, access.source.id))
      .orderBy(desc(referenceTable.version));
    const active = versions.find((v) => v.status === 'active') ?? null;
    return c.json({
      referenceTable: serializeReferenceTable(access.source, active),
      versions: versions.map((v) => ({
        referenceTableId: v.id,
        version: v.version,
        status: v.status,
        rowCount: v.rowCount,
        createdAt: v.createdAt,
      })),
    });
  },
);

// POST /api/reference-tables/:referenceTableId/replace (admin+).
referenceTableRoutes.post(
  '/api/reference-tables/:referenceTableId/replace',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadDataSourceAccess(
      c,
      db,
      c.req.param('referenceTableId'),
    );
    if ('error' in access) return access.error;
    if (!canManageDataSources(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
    }
    return createNewVersion(c, db, access, 'replace');
  },
);

// POST /api/reference-tables/:referenceTableId/append (admin+).
referenceTableRoutes.post(
  '/api/reference-tables/:referenceTableId/append',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadDataSourceAccess(
      c,
      db,
      c.req.param('referenceTableId'),
    );
    if ('error' in access) return access.error;
    if (!canManageDataSources(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Admin role or higher required.');
    }
    return createNewVersion(c, db, access, 'append');
  },
);

// POST /api/reference-tables/:referenceTableId/disable (admin+).
referenceTableRoutes.post(
  '/api/reference-tables/:referenceTableId/disable',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadDataSourceAccess(
      c,
      db,
      c.req.param('referenceTableId'),
    );
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
      .where(eq(dataSource.id, access.source.id))
      .returning();
    await writeAudit(db, {
      orgId: access.workspace.orgId,
      workspaceId: access.source.workspaceId,
      actorUserId: access.user.id,
      actorPersona: rolePersona[access.member.role],
      action: 'reference_table.disabled',
      targetType: 'data_source',
      targetId: access.source.id,
    });
    const active = await getActiveVersion(db, access.source.id);
    return c.json({
      referenceTable: serializeReferenceTable(updated ?? access.source, active),
    });
  },
);

// POST /api/reference-tables/:referenceTableId/test-lookup (viewer+).
referenceTableRoutes.post(
  '/api/reference-tables/:referenceTableId/test-lookup',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadDataSourceAccess(
      c,
      db,
      c.req.param('referenceTableId'),
    );
    if ('error' in access) return access.error;
    if (!canViewWorkspaceData(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
    }

    const active = await getActiveVersion(db, access.source.id);
    if (!active) {
      return jsonError(
        c,
        409,
        'no_active_version',
        'No active reference table version.',
      );
    }

    const body = (await c.req.json().catch(() => null)) as {
      keys?: Record<string, string>;
      key?: string;
    } | null;
    const keyColumns = active.keyColumns as string[];
    const valuesByColumn: Record<string, string | undefined> = {};
    const singleKeyColumn = keyColumns.length === 1 ? keyColumns[0] : undefined;
    if (body?.keys && typeof body.keys === 'object') {
      for (const col of keyColumns) valuesByColumn[col] = body.keys[col];
    } else if (typeof body?.key === 'string' && singleKeyColumn) {
      valuesByColumn[singleKeyColumn] = body.key;
    } else {
      return jsonError(
        c,
        400,
        'key_required',
        'Provide "keys" by column, or "key" for a single-key table.',
      );
    }

    const hashResult = await buildLookupKeyHash(keyColumns, valuesByColumn);
    if (!hashResult.ok) {
      return jsonError(
        c,
        400,
        'missing_key_columns',
        `Missing key values for: ${hashResult.missing.join(', ')}.`,
      );
    }

    const [row] = await db
      .select()
      .from(referenceTableRow)
      .where(
        and(
          eq(referenceTableRow.referenceTableId, active.id),
          eq(referenceTableRow.keyHash, hashResult.hash),
        ),
      )
      .limit(1);

    if (!row) {
      return c.json({ matched: false, values: [] });
    }

    const columns = active.columns as ColumnDef[];
    const outputMappings: OutputMapping[] = columns
      .filter((col) => col.factId)
      .map((col) => ({
        columnName: col.name,
        factId: col.factId as string,
        normalizer: col.normalizer,
      }));

    const factIds = outputMappings.map((m) => m.factId);
    const facts = factIds.length
      ? await db
          .select({
            id: factDefinition.id,
            type: factDefinition.type,
            enumValues: factDefinition.enumValues,
          })
          .from(factDefinition)
          .where(eq(factDefinition.workspaceId, access.source.workspaceId))
      : [];
    const factsById = new Map<string, FactView>(
      facts
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

    const values = projectRow(
      row.data as Record<string, unknown>,
      outputMappings,
      factsById,
      {
        dataSourceId: access.source.id,
        referenceTableId: active.id,
        referenceTableVersion: active.version,
        retrievedAt: new Date().toISOString(),
      },
    );

    return c.json({ matched: true, values });
  },
);
