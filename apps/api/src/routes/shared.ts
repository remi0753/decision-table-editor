import { and, eq, isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createAuth } from '../auth.js';
import type { Database } from '../db/client.js';
import { auditEvent, membership } from '../db/schema.js';
import type { Env } from '../env.js';
import { getAllowedOrigins } from '../origins.js';

export type AppContext = Context<{ Bindings: Env }>;
export type Role = 'owner' | 'admin' | 'editor' | 'viewer' | 'runner';
export type ActorPersona = 'installer' | 'author' | 'unknown';

const roles: Role[] = ['owner', 'admin', 'editor', 'viewer', 'runner'];
const roleRank: Record<Role, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  viewer: 2,
  runner: 1,
};

export const rolePersona: Record<Role, ActorPersona> = {
  owner: 'installer',
  admin: 'installer',
  editor: 'author',
  viewer: 'author',
  runner: 'author',
};

const slugPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  deletedAt?: Date | string | null;
};

export type MembershipRow = {
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

export type RouteError = { error: ReturnType<typeof jsonError> };
export type MembershipAccess = { user: SessionUser; member: MembershipRow };

export function jsonError(
  c: AppContext,
  status: ContentfulStatusCode,
  code: string,
  message: string,
) {
  return c.json({ error: { code, message } }, status);
}

export function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

export function fallbackSlug(prefix: string) {
  return `${prefix}-${randomToken(6).toLowerCase()}`.slice(0, 63);
}

export function parseBodyString(
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

export function parseBodyObject(
  body: unknown,
  field: string,
  required = false,
) {
  if (!body || typeof body !== 'object' || !(field in body)) {
    return required ? null : undefined;
  }

  const value = (body as Record<string, unknown>)[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseBodyNumber(
  body: unknown,
  field: string,
  required = false,
) {
  if (!body || typeof body !== 'object' || !(field in body)) {
    return required ? null : undefined;
  }

  const value = (body as Record<string, unknown>)[field];
  if (!Number.isInteger(value) || (value as number) < 0) return null;
  return value as number;
}

export function parseBodyBoolean(
  body: unknown,
  field: string,
  defaultValue: boolean,
) {
  if (!body || typeof body !== 'object' || !(field in body)) {
    return defaultValue;
  }

  const value = (body as Record<string, unknown>)[field];
  return typeof value === 'boolean' ? value : defaultValue;
}

export function parseRole(body: unknown) {
  const role = parseBodyString(body, 'role', { required: true });
  if (!role || !roles.includes(role as Role)) return null;
  return role as Role;
}

export function assertSlug(c: AppContext, slug: string) {
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

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Base64Url(value: string) {
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

export async function requireUser(c: AppContext, db: Database) {
  const auth = authForRequest(c, db);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return null;
  const sessionUser = session.user as SessionUser;
  if (sessionUser.deletedAt) return null;
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
  };
}

export async function getActiveMembership(
  db: Pick<Database, 'select'>,
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

export async function requireMembership(
  c: AppContext,
  db: Database,
  orgId: string,
): Promise<MembershipAccess | RouteError> {
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

export function canManageMembers(role: Role) {
  return role === 'owner' || role === 'admin';
}

export function canManageWorkspaces(role: Role) {
  return roleRank[role] >= roleRank.editor;
}

export function canEditLogics(role: Role) {
  return roleRank[role] >= roleRank.editor;
}

export function canGrantRole(actorRole: Role, targetRole: Role) {
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole !== 'owner';
}

export async function writeAudit(
  db: Pick<Database, 'insert'>,
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
