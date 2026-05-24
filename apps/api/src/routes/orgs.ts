import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import {
  invitation,
  membership,
  org,
  orgDeletionJob,
  user,
  workspace,
} from '../db/schema.js';
import { sendInvitationEmail } from '../email.js';
import type { Env } from '../env.js';
import {
  type AppContext,
  assertSlug,
  canGrantRole,
  canManageMembers,
  enforceInvitationEmailRateLimit,
  fallbackSlug,
  getActiveMembership,
  jsonError,
  type MembershipRow,
  normalizeSlug,
  parseBodyString,
  parseRole,
  type Role,
  randomToken,
  requireMembership,
  requireUser,
  rolePersona,
  sha256Base64Url,
  writeAudit,
} from './shared.js';

// Temporary anti-abuse cap while the editor is publicly open. The UI does not
// expose an org-creation flow today, so the practical limit is 1 — additional
// org creation is gated behind an explicit product decision.
const MAX_ORGS_PER_USER = 1;

function invitationUrl(c: AppContext, token: string) {
  const url = new URL('/invite', c.env.BETTER_AUTH_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
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

  const [createdByUser] = await db
    .select({ value: count() })
    .from(org)
    .where(
      and(
        eq(org.createdActorType, 'user'),
        eq(org.createdActorId, user.id),
        isNull(org.deletedAt),
      ),
    );
  if ((createdByUser?.value ?? 0) >= MAX_ORGS_PER_USER) {
    return jsonError(
      c,
      403,
      'org_limit_reached',
      `Each account can create up to ${MAX_ORGS_PER_USER} organization(s).`,
    );
  }

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

  if (access.member.role === 'runner') {
    return c.json({
      members: rows.map((row) => ({
        ...row,
        email: null,
        name: null,
        image: null,
      })),
    });
  }

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

  let updated: typeof membership.$inferSelect | undefined;
  if (target.role === 'owner' && nextRole !== 'owner') {
    const result = await db.execute(sql`
      WITH lock AS (
        SELECT pg_advisory_xact_lock(hashtextextended(${orgId}, 0))
      ),
      owner_count AS (
        SELECT count(*) AS value
        FROM membership, lock
        WHERE org_id = ${orgId}::uuid
          AND role = 'owner'
          AND removed_at IS NULL
      )
      UPDATE membership
      SET role = ${nextRole}
      FROM owner_count
      WHERE membership.id = ${membershipId}::uuid
        AND membership.org_id = ${orgId}::uuid
        AND membership.removed_at IS NULL
        AND owner_count.value > 1
      RETURNING *
    `);
    const [row] = rowsFromExecute<typeof membership.$inferSelect>(result);
    if (!row) {
      return jsonError(c, 409, 'last_owner', 'Cannot remove the last owner.');
    }
    updated = row;
  } else {
    const [row] = await db
      .update(membership)
      .set({ role: nextRole })
      .where(
        and(
          eq(membership.id, membershipId),
          eq(membership.orgId, orgId),
          isNull(membership.removedAt),
        ),
      )
      .returning();
    updated = row;
  }

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

  let removed: typeof membership.$inferSelect | undefined;
  if (target.role === 'owner') {
    const result = await db.execute(sql`
      WITH lock AS (
        SELECT pg_advisory_xact_lock(hashtextextended(${orgId}, 0))
      ),
      owner_count AS (
        SELECT count(*) AS value
        FROM membership, lock
        WHERE org_id = ${orgId}::uuid
          AND role = 'owner'
          AND removed_at IS NULL
      )
      UPDATE membership
      SET removed_at = now()
      FROM owner_count
      WHERE membership.id = ${membershipId}::uuid
        AND membership.org_id = ${orgId}::uuid
        AND membership.removed_at IS NULL
        AND owner_count.value > 1
      RETURNING *
    `);
    const [row] = rowsFromExecute<typeof membership.$inferSelect>(result);
    if (!row) {
      return jsonError(c, 409, 'last_owner', 'Cannot remove the last owner.');
    }
    removed = row;
  } else {
    const [row] = await db
      .update(membership)
      .set({ removedAt: new Date() })
      .where(
        and(
          eq(membership.id, membershipId),
          eq(membership.orgId, orgId),
          isNull(membership.removedAt),
        ),
      )
      .returning();
    removed = row;
  }

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

  const normalizedEmail = email.toLowerCase();
  const rateLimitError = await enforceInvitationEmailRateLimit(c, {
    orgId,
    actorUserId: access.user.id,
    email: normalizedEmail,
  });
  if (rateLimitError) return rateLimitError;

  const [targetOrg] = await db.select().from(org).where(eq(org.id, orgId));
  if (!targetOrg) return jsonError(c, 404, 'not_found', 'Org not found.');

  await db
    .update(invitation)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitation.orgId, orgId),
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
      orgId,
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

orgRoutes.get('/api/invitations/preview', async (c) => {
  const token = c.req.query('token') ?? null;
  if (!token) return jsonError(c, 400, 'missing_token', 'Token is required.');

  const db = createDb(c.env.DATABASE_URL);
  const tokenDigest = await sha256Base64Url(token);
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      orgName: org.name,
    })
    .from(invitation)
    .innerJoin(org, eq(invitation.orgId, org.id))
    .where(eq(invitation.tokenDigest, tokenDigest))
    .limit(1);

  if (!row) return jsonError(c, 404, 'not_found', 'Invitation not found.');

  // Intentionally do NOT look up whether the invited email already has an
  // account here. Anyone holding an invitation token can call this endpoint,
  // and editor / admin members can mint invitations for arbitrary addresses —
  // returning that boolean would let them enumerate which addresses already
  // have LEVERIE accounts. The editor's invite page must show both Sign in /
  // Sign up options without precomputing which one applies.
  const sessionUser = await requireUser(c, db);
  const currentUserEmail = sessionUser?.email ?? null;
  const currentUserMatchesInvitation =
    currentUserEmail?.toLowerCase() === row.email.toLowerCase();
  const status = row.acceptedAt
    ? 'accepted'
    : row.revokedAt
      ? 'revoked'
      : row.expiresAt.getTime() < Date.now()
        ? 'expired'
        : 'pending';

  return c.json({
    invitation: {
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt,
      status,
    },
    org: {
      name: row.orgName,
    },
    authHint: {
      currentUserEmail,
      currentUserMatchesInvitation,
    },
  });
});

async function acceptInvitation(c: AppContext, token: string | null) {
  if (!token) return jsonError(c, 400, 'missing_token', 'Token is required.');

  const db = createDb(c.env.DATABASE_URL);
  const sessionUser = await requireUser(c, db);
  if (!sessionUser) return jsonError(c, 401, 'unauthorized', 'Sign in first.');

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
  if (pending.email.toLowerCase() !== sessionUser.email.toLowerCase()) {
    return jsonError(
      c,
      403,
      'email_mismatch',
      'Sign in with the invited email address.',
    );
  }

  const existing = await getActiveMembership(db, pending.orgId, sessionUser.id);
  let acceptedMembership = existing;
  if (!acceptedMembership) {
    const [createdMembership] = await db
      .insert(membership)
      .values({
        orgId: pending.orgId,
        userId: sessionUser.id,
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
      acceptedActorId: sessionUser.id,
    })
    .where(
      and(
        eq(invitation.id, pending.id),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
      ),
    )
    .returning({
      id: invitation.id,
      orgId: invitation.orgId,
      email: invitation.email,
      role: invitation.role,
      acceptedAt: invitation.acceptedAt,
    });

  if (!accepted) {
    return jsonError(
      c,
      409,
      'invitation_already_used',
      'Invitation was already accepted or revoked.',
    );
  }

  await writeAudit(db, {
    orgId: pending.orgId,
    actorUserId: sessionUser.id,
    actorPersona: rolePersona[pending.role as Role],
    action: 'invitation.accepted',
    targetType: 'invitation',
    targetId: pending.id,
  });

  const [acceptedOrg] = await db
    .select()
    .from(org)
    .where(and(eq(org.id, pending.orgId), isNull(org.deletedAt)))
    .limit(1);
  const [defaultWorkspace] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.orgId, pending.orgId), isNull(workspace.deletedAt)))
    .orderBy(desc(workspace.createdAt))
    .limit(1);

  return c.json({
    invitation: accepted,
    membership: acceptedMembership,
    org: acceptedOrg ?? null,
    defaultWorkspace: defaultWorkspace ?? null,
  });
}

orgRoutes.post('/api/invitations/accept', async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = parseBodyString(body, 'token', { required: true });
  return acceptInvitation(c, token ?? null);
});
