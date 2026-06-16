import { and, eq, inArray, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDbQueryExecutor } from '../connectors/dbExecutorRegistry.js';
import { getConnectorSecret } from '../connectors/secrets.js';
import {
  type ExtractedKey,
  extractKeyCandidates,
  type KeyFactView,
} from '../dataWorkspace/keyExtraction.js';
import { createDb, type Database } from '../db/client.js';
import {
  caseContext,
  logic,
  logicVersion,
  logicVersionDataSnapshot,
  referenceTable,
  referenceTableRow,
} from '../db/schema.js';
import type { Env } from '../env.js';
import type { DriverDataSource, DriverDeps } from '../resolvers/driver.js';
import {
  resolveFactsFromSnapshot,
  type SnapshotResolver,
  type SnapshotTable,
} from '../resolvers/runtime.js';
import type {
  FactView,
  KeyColumnMapping,
  OperationRef,
  OutputMapping,
} from '../resolvers/types.js';
import {
  type AppContext,
  canRunDecisions,
  jsonError,
  loadWorkspaceAccess,
  type RouteError,
  type WorkspaceAccess,
} from './shared.js';

export const runnerDataRoutes = new Hono<{ Bindings: Env }>();

// Snapshot shapes (jsonb columns serialized at publish time).
interface SnapshotBinding {
  fieldId: string;
  factId: string;
}
interface SnapshotFact {
  id: string;
  type: string;
  enumValues?: string[] | null;
  kind?: string;
  name?: string;
  aliases?: string[];
}
interface SnapshotResolverRow {
  id: string;
  status: string;
  dataSourceId: string;
  fallbackPolicy?: 'ask_operator' | 'mark_unavailable' | 'block';
  inputFactIds: string[];
  parameterMappings: { keyColumns: KeyColumnMapping[] };
  outputMappings: OutputMapping[];
  operationRef?: OperationRef;
  timeoutPolicy?: { timeoutMs?: number } | null;
}

interface SnapshotDataSourceRow {
  id: string;
  kind: string;
  secretRef?: string | null;
  allowedDomains?: string[] | null;
}
interface SnapshotReferenceTableRef {
  dataSourceId: string;
  referenceTableId: string;
  version: number;
}

type SnapshotRow = typeof logicVersionDataSnapshot.$inferSelect;

export interface RunnerVersionContext {
  access: WorkspaceAccess;
  logicId: string;
  logicVersionId: string;
  versionNumber: number;
  snapshot: SnapshotRow | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_AT_V_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@v([1-9][0-9]*)$/i;

// Resolve a runner ref (bare logicId => production, logicId@vN => exact version)
// to its logic version and pinned data snapshot, after checking membership.
export async function resolveRunnerVersion(
  c: AppContext,
  db: Database,
  workspaceId: string,
  logicRef: string,
): Promise<RunnerVersionContext | RouteError> {
  const access = await loadWorkspaceAccess(c, db, workspaceId);
  if ('error' in access) return access;

  let logicId: string;
  let versionNumber: number | null = null;
  if (UUID_RE.test(logicRef)) {
    logicId = logicRef;
  } else {
    const m = logicRef.match(UUID_AT_V_RE);
    if (!m?.[1]) {
      return {
        error: jsonError(
          c,
          400,
          'invalid_runner_ref',
          'Use /run/<workspaceId>/<logicId> or <logicId>@vN.',
        ),
      };
    }
    logicId = m[1];
    versionNumber = Number(m[2]);
  }

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
    return { error: jsonError(c, 404, 'not_found', 'Logic not found.') };
  }

  let version: typeof logicVersion.$inferSelect | undefined;
  if (versionNumber === null) {
    if (!logicRow.productionVersionId) {
      return {
        error: jsonError(
          c,
          404,
          'no_production',
          'This logic has no production version yet.',
        ),
      };
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
    return {
      error: jsonError(c, 404, 'not_found', 'Runner version not found.'),
    };
  }

  const [snapshot] = await db
    .select()
    .from(logicVersionDataSnapshot)
    .where(eq(logicVersionDataSnapshot.logicVersionId, version.id))
    .limit(1);

  return {
    access,
    logicId,
    logicVersionId: version.id,
    versionNumber: version.versionNumber,
    snapshot: snapshot ?? null,
  };
}

// POST /api/run/:workspaceId/:logicRef/case-contexts — rule-based key
// extraction (§5.6). Stores only extracted candidates, never the raw text.
runnerDataRoutes.post(
  '/api/run/:workspaceId/:logicRef/case-contexts',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const ctx = await resolveRunnerVersion(
      c,
      db,
      c.req.param('workspaceId'),
      c.req.param('logicRef'),
    );
    if ('error' in ctx) return ctx.error;
    if (!canRunDecisions(ctx.access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Membership required to run.');
    }
    if (!ctx.snapshot) {
      return jsonError(
        c,
        409,
        'not_data_connected',
        'This version has no data definitions.',
      );
    }

    const body = (await c.req.json().catch(() => null)) as {
      sourceKind?: unknown;
      text?: unknown;
      facts?: Array<{ factId?: unknown; value?: unknown }>;
    } | null;
    const sourceKind =
      typeof body?.sourceKind === 'string' ? body.sourceKind : 'manual_paste';
    if (
      !['manual_paste', 'url_query', 'clipboard', 'webhook', 'embed'].includes(
        sourceKind,
      )
    ) {
      return jsonError(c, 400, 'invalid_source_kind', 'sourceKind is invalid.');
    }

    const keyFacts: KeyFactView[] = (
      ctx.snapshot.factDefinitions as SnapshotFact[]
    )
      .filter((f) => f.kind === 'key')
      .map((f) => ({
        factId: f.id,
        label: f.name ?? f.id,
        aliases: f.aliases ?? [],
      }));
    const keyFactById = new Map(keyFacts.map((f) => [f.factId, f]));

    // Two intake modes:
    //  - host push (webhook/embed): the host system supplies key facts directly,
    //    so no text parsing is needed (the value is trusted, confidence 1).
    //  - paste/clipboard/url: rule-based extraction from the supplied text.
    const extractedKeys: ExtractedKey[] = [];
    if (Array.isArray(body?.facts) && body.facts.length > 0) {
      for (const f of body.facts) {
        if (typeof f.factId !== 'string' || typeof f.value !== 'string')
          continue;
        const keyFact = keyFactById.get(f.factId);
        if (!keyFact || !f.value.trim()) continue;
        extractedKeys.push({
          factId: keyFact.factId,
          label: keyFact.label,
          value: f.value.trim(),
          confidence: 1,
          source: 'host',
        });
      }
      if (extractedKeys.length === 0) {
        return jsonError(
          c,
          400,
          'no_pushed_keys',
          'facts must include at least one known key fact.',
        );
      }
    } else {
      const text = typeof body?.text === 'string' ? body.text : '';
      if (!text.trim()) {
        return jsonError(c, 400, 'text_required', 'text or facts is required.');
      }
      extractedKeys.push(...extractKeyCandidates(text, keyFacts));
    }

    // Data minimization (§11.4): persist only extracted candidates, expire 24h.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [created] = await db
      .insert(caseContext)
      .values({
        workspaceId: ctx.access.workspace.id,
        sourceKind,
        extractedKeys,
        expiresAt,
        createdBy: ctx.access.user.id,
      })
      .returning();
    if (!created) {
      return jsonError(c, 500, 'case_context_failed', 'Could not create case.');
    }

    return c.json({
      caseContext: {
        id: created.id,
        sourceKind: created.sourceKind,
        extractedKeys,
      },
    });
  },
);

// POST /api/run/:workspaceId/:logicRef/resolve — resolve facts from supplied
// keys/manual values via the published snapshot's resolvers (§5.7).
runnerDataRoutes.post('/api/run/:workspaceId/:logicRef/resolve', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const ctx = await resolveRunnerVersion(
    c,
    db,
    c.req.param('workspaceId'),
    c.req.param('logicRef'),
  );
  if ('error' in ctx) return ctx.error;
  if (!canRunDecisions(ctx.access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Membership required to run.');
  }
  if (!ctx.snapshot) {
    return jsonError(
      c,
      409,
      'not_data_connected',
      'This version has no data definitions.',
    );
  }

  const body = (await c.req.json().catch(() => null)) as {
    caseContextId?: unknown;
    facts?: Array<{ factId?: unknown; value?: unknown }>;
  } | null;

  const availableFacts = new Map<string, string>();

  // Case-context extracted keys (best confidence per fact) feed resolution.
  if (typeof body?.caseContextId === 'string') {
    const [ctxRow] = await db
      .select()
      .from(caseContext)
      .where(
        and(
          eq(caseContext.id, body.caseContextId),
          eq(caseContext.workspaceId, ctx.access.workspace.id),
        ),
      )
      .limit(1);
    if (ctxRow) {
      const byFact = new Map<string, ExtractedKey>();
      for (const k of (ctxRow.extractedKeys as ExtractedKey[]) ?? []) {
        const prev = byFact.get(k.factId);
        if (!prev || k.confidence > prev.confidence) byFact.set(k.factId, k);
      }
      for (const [factId, k] of byFact) availableFacts.set(factId, k.value);
    }
  }

  // Explicit facts (operator keys / manual answers) override case-context keys.
  if (Array.isArray(body?.facts)) {
    for (const f of body.facts) {
      if (typeof f.factId === 'string' && typeof f.value === 'string') {
        availableFacts.set(f.factId, f.value);
      }
    }
  }

  const snapshot = ctx.snapshot;
  const bindings = snapshot.bindings as SnapshotBinding[];
  const factsById = new Map<string, FactView>(
    (snapshot.factDefinitions as SnapshotFact[]).map((f) => [
      f.id,
      {
        id: f.id,
        type: f.type as FactView['type'],
        enumValues: f.enumValues ?? null,
      },
    ]),
  );
  const resolverRows = snapshot.resolverRecipes as SnapshotResolverRow[];
  const resolvers: SnapshotResolver[] = resolverRows.map((r) => ({
    id: r.id,
    status: r.status,
    dataSourceId: r.dataSourceId,
    fallbackPolicy: r.fallbackPolicy,
    inputFactIds: r.inputFactIds ?? [],
    parameterKeyMappings: r.parameterMappings?.keyColumns ?? [],
    outputMappings: r.outputMappings ?? [],
    operationRef: r.operationRef ?? { kind: 'reference_table_lookup' },
  }));

  // Live data sources (database / http) the runtime may dispatch to. Each
  // resolver's timeout is folded into the driver source config.
  const timeoutBySource = new Map<string, number>();
  for (const r of resolverRows) {
    const ms = r.timeoutPolicy?.timeoutMs;
    if (typeof ms === 'number') timeoutBySource.set(r.dataSourceId, ms);
  }
  const sources = new Map<string, DriverDataSource>(
    (snapshot.dataSources as SnapshotDataSourceRow[]).map((s) => [
      s.id,
      {
        id: s.id,
        kind: s.kind,
        secretRef: s.secretRef ?? null,
        config: {
          allowedDomains: s.allowedDomains ?? [],
          ...(timeoutBySource.has(s.id)
            ? { timeoutMs: timeoutBySource.get(s.id) }
            : {}),
        },
      },
    ]),
  );
  const deps: DriverDeps = {
    fetchFn: globalThis.fetch,
    queryExecutor: getDbQueryExecutor(),
    getSecret: (secretRef) => getConnectorSecret({ db, env: c.env, secretRef }),
  };

  // Fetch the pinned reference tables' key columns (immutable for the version).
  const refRefs = snapshot.referenceTables as SnapshotReferenceTableRef[];
  const refIds = refRefs.map((r) => r.referenceTableId);
  const tableRows = refIds.length
    ? await db
        .select({
          id: referenceTable.id,
          keyColumns: referenceTable.keyColumns,
        })
        .from(referenceTable)
        .where(inArray(referenceTable.id, refIds))
    : [];
  const keyColsById = new Map(
    tableRows.map((t) => [t.id, (t.keyColumns as string[]) ?? []]),
  );
  const tables: SnapshotTable[] = refRefs.map((r) => ({
    dataSourceId: r.dataSourceId,
    referenceTableId: r.referenceTableId,
    version: r.version,
    keyColumns: keyColsById.get(r.referenceTableId) ?? [],
  }));

  const result = await resolveFactsFromSnapshot({
    resolvers,
    tables,
    bindings,
    factsById,
    availableFacts,
    fetchRowByHash: async (referenceTableId, keyHash) => {
      const [row] = await db
        .select({ data: referenceTableRow.data })
        .from(referenceTableRow)
        .where(
          and(
            eq(referenceTableRow.referenceTableId, referenceTableId),
            eq(referenceTableRow.keyHash, keyHash),
          ),
        )
        .limit(1);
      return row ? (row.data as Record<string, unknown>) : null;
    },
    sources,
    deps,
    now: new Date(),
  });

  return c.json(result);
});
