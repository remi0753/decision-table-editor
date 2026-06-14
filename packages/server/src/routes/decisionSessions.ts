import { type EvalResult, evaluateTable, type Logic } from '@leverie/engine';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { applyLoggingPolicy } from '../dataWorkspace/masking.js';
import { stableStringify } from '../dataWorkspace/snapshot.js';
import { createDb, type Database } from '../db/client.js';
import {
  decisionFactValue,
  decisionReport,
  decisionSession,
  logicVersion,
  logicVersionDataSnapshot,
  workspace,
} from '../db/schema.js';
import type { Env } from '../env.js';
import { resolveRunnerVersion } from './runnerData.js';
import {
  type AppContext,
  canEditLogics,
  canRunDecisions,
  canViewWorkspaceData,
  jsonError,
  loadWorkspaceAccess,
  type RouteError,
  requireMembership,
  type WorkspaceAccess,
} from './shared.js';

export const decisionSessionRoutes = new Hono<{ Bindings: Env }>();

type SessionRow = typeof decisionSession.$inferSelect;
type ReportRow = typeof decisionReport.$inferSelect;

interface SnapshotFact {
  id: string;
  loggingPolicy?: string;
  sensitive?: boolean;
}

interface IncomingFactValue {
  factId?: unknown;
  fieldId?: unknown;
  value?: unknown;
  state?: unknown;
  sourceKind?: unknown;
  provenance?: unknown;
  dataSourceId?: unknown;
  resolverRecipeId?: unknown;
  referenceTableId?: unknown;
  referenceTableVersion?: unknown;
}

const FACT_STATES = [
  'missing',
  'resolved',
  'needs_confirmation',
  'confirmed',
  'manual',
  'unavailable',
  'invalid',
  'hidden',
];
const FACT_SOURCE_KINDS = [
  'manual',
  'url_query',
  'clipboard',
  'reference_table',
  'api',
  'derived',
  'embed',
  'internal',
];

function serializeSession(row: SessionRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    logicId: row.logicId,
    logicVersionId: row.logicVersionId,
    dataSnapshotId: row.dataSnapshotId,
    caseContextId: row.caseContextId,
    status: row.status,
    result: row.result,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function serializeReport(row: ReportRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    logicId: row.logicId,
    logicVersionId: row.logicVersionId,
    decisionSessionId: row.decisionSessionId,
    kind: row.kind,
    note: row.note,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
  };
}

type SessionAccess = WorkspaceAccess & { session: SessionRow };

async function loadSessionAccess(
  c: AppContext,
  db: Database,
  sessionId: string,
): Promise<SessionAccess | RouteError> {
  const [row] = await db
    .select()
    .from(decisionSession)
    .where(eq(decisionSession.id, sessionId))
    .limit(1);
  if (!row)
    return { error: jsonError(c, 404, 'not_found', 'Session not found.') };
  const access = await loadWorkspaceAccess(c, db, row.workspaceId);
  if ('error' in access) return access;
  return { session: row, ...access };
}

// POST /api/run/:workspaceId/:logicRef/sessions — start a decision session.
decisionSessionRoutes.post(
  '/api/run/:workspaceId/:logicRef/sessions',
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
      caseContextId?: unknown;
    } | null;
    const caseContextId =
      typeof body?.caseContextId === 'string' ? body.caseContextId : null;

    const [created] = await db
      .insert(decisionSession)
      .values({
        workspaceId: ctx.access.workspace.id,
        logicId: ctx.logicId,
        logicVersionId: ctx.logicVersionId,
        dataSnapshotId: ctx.snapshot.id,
        caseContextId,
        status: 'started',
        createdBy: ctx.access.user.id,
      })
      .returning();
    if (!created) {
      return jsonError(c, 500, 'session_failed', 'Could not start session.');
    }
    return c.json({ session: serializeSession(created) }, 201);
  },
);

// GET /api/decision-sessions/:sessionId — session + fact values.
decisionSessionRoutes.get('/api/decision-sessions/:sessionId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadSessionAccess(c, db, c.req.param('sessionId'));
  if ('error' in access) return access.error;
  const isCreator = access.session.createdBy === access.user.id;
  if (!isCreator && !canViewWorkspaceData(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
  }

  const factValues = await db
    .select()
    .from(decisionFactValue)
    .where(eq(decisionFactValue.decisionSessionId, access.session.id));

  return c.json({ session: serializeSession(access.session), factValues });
});

// PATCH /api/decision-sessions/:sessionId — update non-terminal status.
decisionSessionRoutes.patch('/api/decision-sessions/:sessionId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadSessionAccess(c, db, c.req.param('sessionId'));
  if ('error' in access) return access.error;
  const isCreator = access.session.createdBy === access.user.id;
  if (!isCreator && !canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Not allowed to edit this session.');
  }

  const body = (await c.req.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  if (
    typeof body?.status !== 'string' ||
    !['needs_input', 'abandoned'].includes(body.status)
  ) {
    return jsonError(
      c,
      400,
      'invalid_status',
      'status must be needs_input or abandoned.',
    );
  }

  const [updated] = await db
    .update(decisionSession)
    .set({ status: body.status })
    .where(eq(decisionSession.id, access.session.id))
    .returning();
  return c.json({ session: serializeSession(updated ?? access.session) });
});

// POST /api/decision-sessions/:sessionId/complete — server re-evaluates,
// persists masked fact values, and stores the authoritative result (§5.8).
decisionSessionRoutes.post(
  '/api/decision-sessions/:sessionId/complete',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadSessionAccess(c, db, c.req.param('sessionId'));
    if ('error' in access) return access.error;
    const isCreator = access.session.createdBy === access.user.id;
    if (!isCreator && !canRunDecisions(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Not allowed to complete.');
    }
    if (access.session.completedAt) {
      return jsonError(
        c,
        409,
        'already_completed',
        'Session already completed.',
      );
    }

    const [snapshot] = await db
      .select()
      .from(logicVersionDataSnapshot)
      .where(eq(logicVersionDataSnapshot.id, access.session.dataSnapshotId))
      .limit(1);
    const [version] = await db
      .select()
      .from(logicVersion)
      .where(eq(logicVersion.id, access.session.logicVersionId))
      .limit(1);
    if (!snapshot || !version) {
      return jsonError(c, 500, 'snapshot_missing', 'Session data is missing.');
    }

    const body = (await c.req.json().catch(() => null)) as {
      factValues?: IncomingFactValue[];
      result?: { status?: string; outputs?: Record<string, string> };
    } | null;
    const incoming = Array.isArray(body?.factValues) ? body.factValues : [];

    // Dedupe by factId (last wins) and validate enum-ish fields.
    const byFactId = new Map<string, IncomingFactValue>();
    for (const fv of incoming) {
      if (typeof fv.factId !== 'string') continue;
      if (typeof fv.state !== 'string' || !FACT_STATES.includes(fv.state)) {
        return jsonError(
          c,
          400,
          'invalid_state',
          `Invalid state for ${fv.factId}.`,
        );
      }
      if (
        typeof fv.sourceKind !== 'string' ||
        !FACT_SOURCE_KINDS.includes(fv.sourceKind)
      ) {
        return jsonError(
          c,
          400,
          'invalid_source_kind',
          `Invalid sourceKind for ${fv.factId}.`,
        );
      }
      byFactId.set(fv.factId, fv);
    }

    // Build field-keyed inputs and re-evaluate server-side.
    const inputs: Record<string, string> = {};
    for (const fv of byFactId.values()) {
      if (typeof fv.fieldId === 'string' && typeof fv.value === 'string') {
        inputs[fv.fieldId] = fv.value;
      }
    }
    const logicData = version.data as Logic;
    const serverResult: EvalResult = evaluateTable(
      logicData.entryTableId,
      inputs,
      logicData,
    );
    const serverStatus =
      serverResult.status === 'ok' ? 'decision_ready' : 'no_match';

    // Do not trust the browser's result: compare and 409 on disagreement.
    if (body?.result && typeof body.result.status === 'string') {
      const browserStatus =
        body.result.status === 'ok'
          ? 'decision_ready'
          : body.result.status === 'no_match'
            ? 'no_match'
            : null;
      if (browserStatus && browserStatus !== serverStatus) {
        return jsonError(
          c,
          409,
          'decision_mismatch',
          'Server re-evaluation disagrees with the submitted result.',
        );
      }
      if (
        serverResult.status === 'ok' &&
        body.result.outputs &&
        stableStringify(body.result.outputs) !==
          stableStringify(serverResult.outputs)
      ) {
        return jsonError(
          c,
          409,
          'decision_mismatch',
          'Server outputs disagree with the submitted outputs.',
        );
      }
    }

    const resultJson =
      serverResult.status === 'ok'
        ? { status: 'ok', outputs: serverResult.outputs }
        : { status: 'no_match' };

    // Persist fact values with masking per the fact's logging policy.
    const factById = new Map<string, SnapshotFact>(
      (snapshot.factDefinitions as SnapshotFact[]).map((f) => [f.id, f]),
    );
    const rows: (typeof decisionFactValue.$inferInsert)[] = [];
    for (const fv of byFactId.values()) {
      const factId = fv.factId as string;
      const policy = (factById.get(factId)?.loggingPolicy ?? 'full') as
        | 'full'
        | 'masked'
        | 'hash'
        | 'omit';
      const hasValue = typeof fv.value === 'string';
      const stored = hasValue
        ? await applyLoggingPolicy(
            fv.value as string,
            policy,
            access.workspace.id,
          )
        : { value: null, maskedValue: null };
      rows.push({
        decisionSessionId: access.session.id,
        factId,
        fieldId: typeof fv.fieldId === 'string' ? fv.fieldId : null,
        value: stored.value,
        maskedValue: stored.maskedValue,
        state: fv.state as string,
        sourceKind: fv.sourceKind as string,
        dataSourceId:
          typeof fv.dataSourceId === 'string' ? fv.dataSourceId : null,
        resolverRecipeId:
          typeof fv.resolverRecipeId === 'string' ? fv.resolverRecipeId : null,
        referenceTableId:
          typeof fv.referenceTableId === 'string' ? fv.referenceTableId : null,
        referenceTableVersion:
          typeof fv.referenceTableVersion === 'number'
            ? fv.referenceTableVersion
            : null,
        provenance:
          fv.provenance && typeof fv.provenance === 'object'
            ? (fv.provenance as Record<string, unknown>)
            : {},
      });
    }

    // Atomic: replace fact values + finalize the session (neon-http db.batch).
    const del = db
      .delete(decisionFactValue)
      .where(eq(decisionFactValue.decisionSessionId, access.session.id));
    const upd = db
      .update(decisionSession)
      .set({
        status: serverStatus,
        result: resultJson,
        trace: serverResult.trace ?? null,
        completedAt: new Date(),
      })
      .where(eq(decisionSession.id, access.session.id));
    if (rows.length > 0) {
      await db.batch([del, db.insert(decisionFactValue).values(rows), upd]);
    } else {
      await db.batch([del, upd]);
    }

    const [updated] = await db
      .select()
      .from(decisionSession)
      .where(eq(decisionSession.id, access.session.id))
      .limit(1);

    return c.json({
      session: serializeSession(updated ?? access.session),
      result: resultJson,
    });
  },
);

// POST /api/decision-sessions/:sessionId/reports — operator issue report (§5.9).
decisionSessionRoutes.post(
  '/api/decision-sessions/:sessionId/reports',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadSessionAccess(c, db, c.req.param('sessionId'));
    if ('error' in access) return access.error;
    if (!canRunDecisions(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Membership required to report.');
    }

    const body = (await c.req.json().catch(() => null)) as {
      kind?: unknown;
      note?: unknown;
    } | null;
    const validKinds = [
      'no_match',
      'wrong_fact',
      'missing_source',
      'confusing_question',
      'wrong_result_text',
      'exception_required',
    ];
    if (typeof body?.kind !== 'string' || !validKinds.includes(body.kind)) {
      return jsonError(c, 400, 'invalid_kind', 'kind is invalid.');
    }
    const note =
      typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : null;

    const [created] = await db
      .insert(decisionReport)
      .values({
        workspaceId: access.session.workspaceId,
        logicId: access.session.logicId,
        logicVersionId: access.session.logicVersionId,
        decisionSessionId: access.session.id,
        kind: body.kind,
        note,
        status: 'open',
        createdBy: access.user.id,
      })
      .returning();
    if (!created) {
      return jsonError(c, 500, 'report_failed', 'Could not create report.');
    }
    return c.json({ report: serializeReport(created) }, 201);
  },
);

// GET /api/workspaces/:workspaceId/decision-reports — owner/editor queue (§5.9).
decisionSessionRoutes.get(
  '/api/workspaces/:workspaceId/decision-reports',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const access = await loadWorkspaceAccess(c, db, c.req.param('workspaceId'));
    if ('error' in access) return access.error;
    if (!canEditLogics(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
    }
    const rows = await db
      .select()
      .from(decisionReport)
      .where(eq(decisionReport.workspaceId, access.workspace.id))
      .orderBy(desc(decisionReport.createdAt));
    return c.json({ reports: rows.map(serializeReport) });
  },
);

// PATCH /api/decision-reports/:reportId — triage a report (§5.9).
decisionSessionRoutes.patch('/api/decision-reports/:reportId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [report] = await db
    .select()
    .from(decisionReport)
    .where(eq(decisionReport.id, c.req.param('reportId')))
    .limit(1);
  if (!report) return jsonError(c, 404, 'not_found', 'Report not found.');

  const [ws] = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, report.workspaceId))
    .limit(1);
  if (!ws) return jsonError(c, 404, 'not_found', 'Workspace not found.');
  const access = await requireMembership(c, db, ws.orgId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = (await c.req.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  if (
    typeof body?.status !== 'string' ||
    !['open', 'reviewing', 'resolved', 'dismissed'].includes(body.status)
  ) {
    return jsonError(c, 400, 'invalid_status', 'status is invalid.');
  }
  const terminal = body.status === 'resolved' || body.status === 'dismissed';

  const [updated] = await db
    .update(decisionReport)
    .set({
      status: body.status,
      resolvedAt: terminal ? new Date() : null,
      resolvedBy: terminal ? access.user.id : null,
    })
    .where(eq(decisionReport.id, report.id))
    .returning();
  return c.json({ report: serializeReport(updated ?? report) });
});
