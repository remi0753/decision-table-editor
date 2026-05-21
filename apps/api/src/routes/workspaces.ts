import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { workspace } from '../db/schema.js';
import type { Env } from '../env.js';
import {
  assertSlug,
  canManageWorkspaces,
  fallbackSlug,
  jsonError,
  normalizeSlug,
  parseBodyString,
  requireMembership,
  rolePersona,
  writeAudit,
} from './shared.js';

export const workspaceRoutes = new Hono<{ Bindings: Env }>();

workspaceRoutes.get('/api/orgs/:orgId/workspaces', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;

  const rows = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.orgId, orgId), isNull(workspace.deletedAt)))
    .orderBy(desc(workspace.createdAt));

  return c.json({ workspaces: rows });
});

workspaceRoutes.post('/api/orgs/:orgId/workspaces', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;
  if (!canManageWorkspaces(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { required: true, max: 120 });
  if (!name) return jsonError(c, 400, 'invalid_name', 'Name is required.');

  const requestedSlug = parseBodyString(body, 'slug', { max: 63 });
  const slug = requestedSlug
    ? normalizeSlug(requestedSlug)
    : normalizeSlug(name) || fallbackSlug('workspace');
  const slugError = assertSlug(c, slug);
  if (slugError) return slugError;

  const description = parseBodyString(body, 'description', { max: 500 });
  const [created] = await db
    .insert(workspace)
    .values({
      orgId,
      name,
      slug,
      description,
      createdActorType: 'user',
      createdActorId: access.user.id,
    })
    .returning();

  if (!created) {
    return jsonError(
      c,
      500,
      'workspace_create_failed',
      'Could not create workspace.',
    );
  }

  await writeAudit(db, {
    orgId,
    workspaceId: created.id,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'workspace.created',
    targetType: 'workspace',
    targetId: created.id,
  });

  return c.json({ workspace: created }, 201);
});

workspaceRoutes.patch('/api/workspaces/:workspaceId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const [existing] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, workspaceId), isNull(workspace.deletedAt)))
    .limit(1);
  if (!existing) return jsonError(c, 404, 'not_found', 'Workspace not found.');

  const access = await requireMembership(c, db, existing.orgId);
  if ('error' in access) return access.error;
  if (!canManageWorkspaces(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { max: 120 });
  const slugInput = parseBodyString(body, 'slug', { max: 63 });
  const description = parseBodyString(body, 'description', { max: 500 });
  const update: Partial<typeof workspace.$inferInsert> = {
    updatedActorType: 'user',
    updatedActorId: access.user.id,
  };

  if (name) update.name = name;
  if (description !== undefined) update.description = description ?? null;
  if (slugInput) {
    const slug = normalizeSlug(slugInput);
    const slugError = assertSlug(c, slug);
    if (slugError) return slugError;
    update.slug = slug;
  }

  const [updated] = await db
    .update(workspace)
    .set(update)
    .where(eq(workspace.id, workspaceId))
    .returning();

  await writeAudit(db, {
    orgId: existing.orgId,
    workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'workspace.updated',
    targetType: 'workspace',
    targetId: workspaceId,
  });

  return c.json({ workspace: updated });
});

workspaceRoutes.delete('/api/workspaces/:workspaceId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const workspaceId = c.req.param('workspaceId');
  const [existing] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, workspaceId), isNull(workspace.deletedAt)))
    .limit(1);
  if (!existing) return jsonError(c, 404, 'not_found', 'Workspace not found.');

  const access = await requireMembership(c, db, existing.orgId);
  if ('error' in access) return access.error;
  if (!canManageWorkspaces(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Editor role or higher required.');
  }

  const [deleted] = await db
    .update(workspace)
    .set({
      deletedAt: new Date(),
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(eq(workspace.id, workspaceId))
    .returning();

  await writeAudit(db, {
    orgId: existing.orgId,
    workspaceId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'workspace.deleted',
    targetType: 'workspace',
    targetId: workspaceId,
  });

  return c.json({ workspace: deleted });
});
