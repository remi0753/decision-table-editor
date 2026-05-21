import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createAuth } from '../auth.js';
import { createDb, type Database } from '../db/client.js';
import {
  auditEvent,
  invitation,
  membership,
  org,
  orgDeletionJob,
  user,
  workspace,
} from '../db/schema.js';
import { sendInvitationEmail } from '../email.js';
import type { Env } from '../env.js';
import { getAllowedOrigins } from '../origins.js';

type AppContext = Context<{ Bindings: Env }>;
type Role = 'owner' | 'admin' | 'editor' | 'viewer' | 'runner';
type ActorPersona = 'installer' | 'author' | 'unknown';

const roles: Role[] = ['owner', 'admin', 'editor', 'viewer', 'runner'];
const roleRank: Record<Role, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  viewer: 2,
  runner: 1,
};

const rolePersona: Record<Role, ActorPersona> = {
  owner: 'installer',
  admin: 'installer',
  editor: 'author',
  viewer: 'author',
  runner: 'author',
};

const slugPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
};

type MembershipRow = {
  id: string;
  orgId: string;
  userId: string;
  role: Role;
  invitedActorType: string;
  invitedActorId: string | null;
  invitedAt: Date;
  joinedAt: Date;
  removedAt: Date | null;
};

function jsonError(
  c: AppContext,
  status: ContentfulStatusCode,
  code: string,
  message: string,
) {
  return c.json({ error: { code, message } }, status);
}

function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

function fallbackSlug(prefix: string) {
  return `${prefix}-${randomToken(6).toLowerCase()}`.slice(0, 63);
}

function parseBodyString(
  body: unknown,
  field: string,
  options: { required?: boolean; max?: number } = {},
) {
  if (!body || typeof body !== 'object' || !(field in body)) {
    return options.required ? null : undefined;
  }

  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed && options.required) return null;
  if (options.max !== undefined && trimmed.length > options.max) return null;
  return trimmed || undefined;
}

function parseRole(body: unknown) {
  const role = parseBodyString(body, 'role', { required: true });
  if (!role || !roles.includes(role as Role)) return null;
  return role as Role;
}

function assertSlug(c: AppContext, slug: string) {
  if (!slugPattern.test(slug)) {
    return jsonError(
      c,
      400,
      'invalid_slug',
      'Slug must be 1-63 chars: lowercase letters, numbers, and single hyphens.',
    );
  }
  return null;
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const raw = Array.from(new Uint8Array(digest), (byte) =>
    String.fromCharCode(byte),
  ).join('');
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function authForRequest(c: AppContext, db: Database) {
  return createAuth(db, {
    baseURL: c.env.BETTER_AUTH_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    trustedOrigins: getAllowedOrigins(c.env),
    googleClientId: c.env.GOOGLE_CLIENT_ID,
    googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
    resendApiKey: c.env.RESEND_API_KEY,
    emailFrom: c.env.EMAIL_FROM,
  });
}

async function requireUser(c: AppContext, db: Database) {
  const auth = authForRequest(c, db);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return null;
  return session.user as SessionUser;
}

async function getActiveMembership(
  db: Database,
  orgId: string,
  userId: string,
) {
  const [row] = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.orgId, orgId),
        eq(membership.userId, userId),
        isNull(membership.removedAt),
      ),
    )
    .limit(1);

  return row as MembershipRow | undefined;
}

async function requireMembership(c: AppContext, db: Database, orgId: string) {
  const user = await requireUser(c, db);
  if (!user)
    return { error: jsonError(c, 401, 'unauthorized', 'Sign in first.') };

  const member = await getActiveMembership(db, orgId, user.id);
  if (!member) {
    return {
      error: jsonError(
        c,
        403,
        'forbidden',
        'You are not a member of this org.',
      ),
    };
  }

  return { user, member };
}

function canManageMembers(role: Role) {
  return role === 'owner' || role === 'admin';
}

function canManageWorkspaces(role: Role) {
  return roleRank[role] >= roleRank.editor;
}

function canGrantRole(actorRole: Role, targetRole: Role) {
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole !== 'owner';
}

async function activeOwnerCount(db: Database, orgId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(membership)
    .where(
      and(
        eq(membership.orgId, orgId),
        eq(membership.role, 'owner'),
        isNull(membership.removedAt),
      ),
    );
  return row?.value ?? 0;
}

async function writeAudit(
  db: Database,
  input: {
    orgId: string;
    workspaceId?: string | null;
    actorUserId: string;
    actorPersona: ActorPersona;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(auditEvent).values({
    orgId: input.orgId,
    workspaceId: input.workspaceId,
    eventClass: 'security',
    actorType: 'user',
    actorUserId: input.actorUserId,
    actorPersona: input.actorPersona,
    actorChannel: 'web',
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {},
  });
}

function invitationUrl(c: AppContext, token: string) {
  const url = new URL('/api/invitations/accept', c.env.BETTER_AUTH_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

export const orgRoutes = new Hono<{ Bindings: Env }>();

orgRoutes.get('/api/me', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const user = await requireUser(c, db);
  if (!user) return jsonError(c, 401, 'unauthorized', 'Sign in first.');

  const rows = await db
    .select({
      membershipId: membership.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      orgPlan: org.plan,
    })
    .from(membership)
    .innerJoin(org, eq(membership.orgId, org.id))
    .where(
      and(
        eq(membership.userId, user.id),
        isNull(membership.removedAt),
        isNull(org.deletedAt),
      ),
    )
    .orderBy(desc(membership.joinedAt));

  return c.json({
    user,
    orgs: rows.map((row) => ({
      membershipId: row.membershipId,
      role: row.role,
      joinedAt: row.joinedAt,
      org: {
        id: row.orgId,
        slug: row.orgSlug,
        name: row.orgName,
        plan: row.orgPlan,
      },
    })),
  });
});

orgRoutes.get('/api/orgs', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const user = await requireUser(c, db);
  if (!user) return jsonError(c, 401, 'unauthorized', 'Sign in first.');

  const rows = await db
    .select({
      membershipId: membership.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
      id: org.id,
      slug: org.slug,
      name: org.name,
      plan: org.plan,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    })
    .from(membership)
    .innerJoin(org, eq(membership.orgId, org.id))
    .where(
      and(
        eq(membership.userId, user.id),
        isNull(membership.removedAt),
        isNull(org.deletedAt),
      ),
    )
    .orderBy(desc(membership.joinedAt));

  return c.json({ orgs: rows });
});

orgRoutes.post('/api/orgs', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const user = await requireUser(c, db);
  if (!user) return jsonError(c, 401, 'unauthorized', 'Sign in first.');

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { required: true, max: 120 });
  if (!name) return jsonError(c, 400, 'invalid_name', 'Name is required.');

  const requestedSlug = parseBodyString(body, 'slug', { max: 63 });
  const slug = requestedSlug
    ? normalizeSlug(requestedSlug)
    : normalizeSlug(name) || fallbackSlug('org');
  const slugError = assertSlug(c, slug);
  if (slugError) return slugError;

  const [createdOrg] = await db
    .insert(org)
    .values({
      name,
      slug,
      createdActorType: 'user',
      createdActorId: user.id,
    })
    .returning();

  if (!createdOrg) {
    return jsonError(c, 500, 'org_create_failed', 'Could not create org.');
  }

  const [createdMembership] = await db
    .insert(membership)
    .values({
      orgId: createdOrg.id,
      userId: user.id,
      role: 'owner',
      invitedActorType: 'user',
      invitedActorId: user.id,
    })
    .returning();

  const defaultWorkspaceSlug = 'default';
  const [createdWorkspace] = await db
    .insert(workspace)
    .values({
      orgId: createdOrg.id,
      slug: defaultWorkspaceSlug,
      name: 'Default workspace',
      createdActorType: 'user',
      createdActorId: user.id,
    })
    .returning();

  await writeAudit(db, {
    orgId: createdOrg.id,
    actorUserId: user.id,
    actorPersona: 'installer',
    action: 'org.created',
    targetType: 'org',
    targetId: createdOrg.id,
  });

  return c.json(
    {
      org: createdOrg,
      membership: createdMembership,
      defaultWorkspace: createdWorkspace,
    },
    201,
  );
});

orgRoutes.patch('/api/orgs/:orgId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;
  if (access.member.role !== 'owner' && access.member.role !== 'admin') {
    return jsonError(c, 403, 'forbidden', 'Owner or admin role required.');
  }

  const body = await c.req.json().catch(() => null);
  const name = parseBodyString(body, 'name', { max: 120 });
  const slugInput = parseBodyString(body, 'slug', { max: 63 });
  const update: Partial<typeof org.$inferInsert> = {
    updatedActorType: 'user',
    updatedActorId: access.user.id,
  };

  if (name) update.name = name;
  if (slugInput) {
    const slug = normalizeSlug(slugInput);
    const slugError = assertSlug(c, slug);
    if (slugError) return slugError;
    update.slug = slug;
  }

  const [updated] = await db
    .update(org)
    .set(update)
    .where(and(eq(org.id, orgId), isNull(org.deletedAt)))
    .returning();

  if (!updated) return jsonError(c, 404, 'not_found', 'Org not found.');

  await writeAudit(db, {
    orgId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'org.updated',
    targetType: 'org',
    targetId: orgId,
  });

  return c.json({ org: updated });
});

orgRoutes.delete('/api/orgs/:orgId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;
  if (access.member.role !== 'owner') {
    return jsonError(c, 403, 'forbidden', 'Owner role required.');
  }

  const now = new Date();
  const purgeRequestedAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [updated] = await db
    .update(org)
    .set({
      lifecycleStatus: 'deleting',
      deletedAt: now,
      purgeRequestedAt,
      updatedActorType: 'user',
      updatedActorId: access.user.id,
    })
    .where(and(eq(org.id, orgId), isNull(org.deletedAt)))
    .returning();

  if (!updated) return jsonError(c, 404, 'not_found', 'Org not found.');

  const [job] = await db
    .insert(orgDeletionJob)
    .values({
      orgId,
      orgSlugSnapshot: updated.slug,
      orgNameSnapshot: updated.name,
      status: 'queued',
      requestedAt: now,
      requestedActorType: 'user',
      requestedActorId: access.user.id,
    })
    .returning();

  await writeAudit(db, {
    orgId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'org.deletion_requested',
    targetType: 'org',
    targetId: orgId,
    metadata: { purgeRequestedAt: purgeRequestedAt.toISOString() },
  });

  return c.json({ org: updated, deletionJob: job });
});

orgRoutes.get('/api/orgs/:orgId/workspaces', async (c) => {
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

orgRoutes.post('/api/orgs/:orgId/workspaces', async (c) => {
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

orgRoutes.patch('/api/workspaces/:workspaceId', async (c) => {
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

orgRoutes.delete('/api/workspaces/:workspaceId', async (c) => {
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

orgRoutes.get('/api/orgs/:orgId/members', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;

  const rows = await db
    .select({
      membershipId: membership.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
      userId: membership.userId,
      email: user.email,
      name: user.name,
      image: user.image,
    })
    .from(membership)
    .innerJoin(user, eq(membership.userId, user.id))
    .where(and(eq(membership.orgId, orgId), isNull(membership.removedAt)))
    .orderBy(desc(membership.joinedAt));

  return c.json({ members: rows });
});

orgRoutes.patch('/api/orgs/:orgId/members/:membershipId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const membershipId = c.req.param('membershipId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;
  if (!canManageMembers(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Owner or admin role required.');
  }

  const body = await c.req.json().catch(() => null);
  const nextRole = parseRole(body);
  if (!nextRole) return jsonError(c, 400, 'invalid_role', 'Invalid role.');
  if (!canGrantRole(access.member.role, nextRole)) {
    return jsonError(c, 403, 'forbidden', 'You cannot grant that role.');
  }

  const [target] = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.id, membershipId),
        eq(membership.orgId, orgId),
        isNull(membership.removedAt),
      ),
    )
    .limit(1);
  if (!target) return jsonError(c, 404, 'not_found', 'Member not found.');

  if (target.role === 'owner' && nextRole !== 'owner') {
    const owners = await activeOwnerCount(db, orgId);
    if (owners <= 1) {
      return jsonError(c, 409, 'last_owner', 'Cannot remove the last owner.');
    }
  }

  const [updated] = await db
    .update(membership)
    .set({ role: nextRole })
    .where(eq(membership.id, membershipId))
    .returning();

  await writeAudit(db, {
    orgId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'membership.role_changed',
    targetType: 'membership',
    targetId: membershipId,
    metadata: { previousRole: target.role, nextRole },
  });

  return c.json({ membership: updated });
});

orgRoutes.delete('/api/orgs/:orgId/members/:membershipId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const membershipId = c.req.param('membershipId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;
  if (!canManageMembers(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Owner or admin role required.');
  }

  const [target] = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.id, membershipId),
        eq(membership.orgId, orgId),
        isNull(membership.removedAt),
      ),
    )
    .limit(1);
  if (!target) return jsonError(c, 404, 'not_found', 'Member not found.');

  if (target.role === 'owner') {
    const owners = await activeOwnerCount(db, orgId);
    if (owners <= 1) {
      return jsonError(c, 409, 'last_owner', 'Cannot remove the last owner.');
    }
  }

  const [removed] = await db
    .update(membership)
    .set({ removedAt: new Date() })
    .where(eq(membership.id, membershipId))
    .returning();

  await writeAudit(db, {
    orgId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'membership.removed',
    targetType: 'membership',
    targetId: membershipId,
  });

  return c.json({ membership: removed });
});

orgRoutes.get('/api/orgs/:orgId/invitations', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;
  if (!canManageMembers(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Owner or admin role required.');
  }

  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .where(eq(invitation.orgId, orgId))
    .orderBy(desc(invitation.createdAt));

  return c.json({ invitations: rows });
});

orgRoutes.post('/api/orgs/:orgId/invitations', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const orgId = c.req.param('orgId');
  const access = await requireMembership(c, db, orgId);
  if ('error' in access) return access.error;
  if (!canManageMembers(access.member.role)) {
    return jsonError(c, 403, 'forbidden', 'Owner or admin role required.');
  }

  const body = await c.req.json().catch(() => null);
  const email = parseBodyString(body, 'email', { required: true, max: 320 });
  const role = parseRole(body);
  if (!email?.includes('@')) {
    return jsonError(c, 400, 'invalid_email', 'Valid email is required.');
  }
  if (!role) return jsonError(c, 400, 'invalid_role', 'Invalid role.');
  if (!canGrantRole(access.member.role, role)) {
    return jsonError(c, 403, 'forbidden', 'You cannot invite that role.');
  }

  const [targetOrg] = await db.select().from(org).where(eq(org.id, orgId));
  if (!targetOrg) return jsonError(c, 404, 'not_found', 'Org not found.');

  await db
    .update(invitation)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitation.orgId, orgId),
        eq(invitation.email, email.toLowerCase()),
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
      orgId,
      email: email.toLowerCase(),
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

  const url = invitationUrl(c, token);
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
      url,
      expiresAt,
    },
  );

  await writeAudit(db, {
    orgId,
    actorUserId: access.user.id,
    actorPersona: rolePersona[access.member.role],
    action: 'invitation.created',
    targetType: 'invitation',
    targetId: created.id,
    metadata: { email: created.email, role: created.role },
  });

  return c.json({ invitation: created, acceptUrl: url }, 201);
});

orgRoutes.post(
  '/api/orgs/:orgId/invitations/:invitationId/revoke',
  async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const orgId = c.req.param('orgId');
    const invitationId = c.req.param('invitationId');
    const access = await requireMembership(c, db, orgId);
    if ('error' in access) return access.error;
    if (!canManageMembers(access.member.role)) {
      return jsonError(c, 403, 'forbidden', 'Owner or admin role required.');
    }

    const [revoked] = await db
      .update(invitation)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.orgId, orgId),
          isNull(invitation.acceptedAt),
          isNull(invitation.revokedAt),
        ),
      )
      .returning({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        revokedAt: invitation.revokedAt,
      });

    if (!revoked) {
      return jsonError(c, 404, 'not_found', 'Pending invitation not found.');
    }

    await writeAudit(db, {
      orgId,
      actorUserId: access.user.id,
      actorPersona: rolePersona[access.member.role],
      action: 'invitation.revoked',
      targetType: 'invitation',
      targetId: invitationId,
    });

    return c.json({ invitation: revoked });
  },
);

async function acceptInvitation(c: AppContext, token: string | null) {
  if (!token) return jsonError(c, 400, 'missing_token', 'Token is required.');

  const db = createDb(c.env.DATABASE_URL);
  const user = await requireUser(c, db);
  if (!user) return jsonError(c, 401, 'unauthorized', 'Sign in first.');

  const tokenDigest = await sha256Base64Url(token);
  const [pending] = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.tokenDigest, tokenDigest),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
      ),
    )
    .limit(1);

  if (!pending) {
    return jsonError(c, 404, 'not_found', 'Invitation not found.');
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    return jsonError(c, 410, 'expired', 'Invitation has expired.');
  }
  if (pending.email.toLowerCase() !== user.email.toLowerCase()) {
    return jsonError(
      c,
      403,
      'email_mismatch',
      'Sign in with the invited email address.',
    );
  }

  const existing = await getActiveMembership(db, pending.orgId, user.id);
  let acceptedMembership = existing;
  if (!acceptedMembership) {
    const [createdMembership] = await db
      .insert(membership)
      .values({
        orgId: pending.orgId,
        userId: user.id,
        role: pending.role as Role,
        invitedActorType: pending.invitedActorType,
        invitedActorId: pending.invitedActorId,
      })
      .returning();
    acceptedMembership = createdMembership as MembershipRow | undefined;
  }

  if (!acceptedMembership) {
    return jsonError(
      c,
      500,
      'membership_create_failed',
      'Could not create membership.',
    );
  }

  const [accepted] = await db
    .update(invitation)
    .set({
      acceptedAt: new Date(),
      acceptedActorType: 'user',
      acceptedActorId: user.id,
    })
    .where(eq(invitation.id, pending.id))
    .returning({
      id: invitation.id,
      orgId: invitation.orgId,
      email: invitation.email,
      role: invitation.role,
      acceptedAt: invitation.acceptedAt,
    });

  await writeAudit(db, {
    orgId: pending.orgId,
    actorUserId: user.id,
    actorPersona: rolePersona[pending.role as Role],
    action: 'invitation.accepted',
    targetType: 'invitation',
    targetId: pending.id,
  });

  return c.json({ invitation: accepted, membership: acceptedMembership });
}

orgRoutes.get('/api/invitations/accept', async (c) => {
  return acceptInvitation(c, c.req.query('token') ?? null);
});

orgRoutes.post('/api/invitations/accept', async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = parseBodyString(body, 'token', { required: true });
  return acceptInvitation(c, token ?? null);
});
