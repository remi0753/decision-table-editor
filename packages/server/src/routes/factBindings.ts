import type { Logic } from '@leverie/engine';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  type BindingFactView,
  type FactStatus,
  type FactType,
  validateBindings,
} from '../dataWorkspace/factValidation.js';
import { createDb } from '../db/client.js';
import { factDefinition, logicFactBinding } from '../db/schema.js';
import type { Env } from '../env.js';
import {
  canEditLogics,
  canViewWorkspaceData,
  jsonError,
  loadLogicAccess,
  rolePersona,
  writeAudit,
} from './shared.js';

export const factBindingRoutes = new Hono<{ Bindings: Env }>();

type BindingRow = typeof logicFactBinding.$inferSelect;

function serializeBinding(row: BindingRow) {
  return { fieldId: row.fieldId, factId: row.factId };
}

// GET /api/logics/:logicId/fact-bindings — list current bindings (viewer+).
factBindingRoutes.get('/api/logics/:logicId/fact-bindings', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const access = await loadLogicAccess(c, db, c.req.param('logicId'));
  if ('error' in access) return access.error;
  if (!canViewWorkspaceData(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Viewer role or higher required.');
  }

  const rows = await db
    .select()
    .from(logicFactBinding)
    .where(eq(logicFactBinding.logicId, access.logic.id));

  return c.json({ bindings: rows.map(serializeBinding) });
});

// PUT /api/logics/:logicId/fact-bindings — replace the full binding list
// atomically (editor+). Validates against the draft logic's field defs and the
// workspace fact catalog (§5.2).
factBindingRoutes.put('/api/logics/:logicId/fact-bindings', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const logicId = c.req.param('logicId');
  const access = await loadLogicAccess(c, db, logicId);
  if ('error' in access) return access.error;
  if (!canEditLogics(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = (await c.req.json().catch(() => null)) as {
    bindings?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return jsonError(c, 400, 'invalid_body', 'Request body is required.');
  }

  const logicData = access.logic.draftData as Logic;
  const fieldDefs = logicData.fieldDefs ?? {};

  const facts = await db
    .select({
      id: factDefinition.id,
      type: factDefinition.type,
      status: factDefinition.status,
      enumValues: factDefinition.enumValues,
    })
    .from(factDefinition)
    .where(eq(factDefinition.workspaceId, access.logic.workspaceId));

  const factViews: BindingFactView[] = facts.map((f) => ({
    id: f.id,
    type: f.type as FactType,
    status: f.status as FactStatus,
    enumValues: (f.enumValues as string[] | null) ?? null,
  }));

  const result = validateBindings(fieldDefs, factViews, body.bindings);
  if (!result.ok) {
    return jsonError(c, 400, result.error.code, result.error.message);
  }

  const deleteOp = db
    .delete(logicFactBinding)
    .where(eq(logicFactBinding.logicId, logicId));

  if (result.bindings.length === 0) {
    await deleteOp;
  } else {
    const insertOp = db.insert(logicFactBinding).values(
      result.bindings.map((b) => ({
        workspaceId: access.logic.workspaceId,
        logicId,
        fieldId: b.fieldId,
        factId: b.factId,
      })),
    );
    // neon-http has no interactive transactions; db.batch runs the delete +
    // insert as one transaction so the replace is atomic.
    await db.batch([deleteOp, insertOp]);
  }

  await writeAudit(db, {
    orgId: access.workspace.orgId,
    workspaceId: access.logic.workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'logic.fact_bindings_updated',
    targetType: 'logic',
    targetId: logicId,
    metadata: { count: result.bindings.length },
  });

  return c.json({ bindings: result.bindings });
});
