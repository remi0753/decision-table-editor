import type { Logic } from '@leverie/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  email: string;
  name: string;
};

type WriteOperation = {
  table: unknown;
  values?: unknown;
  set?: unknown;
  returning?: unknown;
};

type FakeDb = ReturnType<typeof createFakeDb>;

const ownerUser: SessionUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'owner@example.test',
  name: 'Owner',
};

const editorUser: SessionUser = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'editor@example.test',
  name: 'Editor',
};

const invitedUser: SessionUser = {
  id: '33333333-3333-3333-3333-333333333333',
  email: 'invited@example.test',
  name: 'Invited',
};

const baseEnv = {
  DATABASE_URL: 'postgres://unit-test',
  BETTER_AUTH_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'test-secret',
  CORS_ALLOWED_ORIGINS: '',
};

let currentDb: FakeDb;
let currentUser: SessionUser | null;

vi.mock('../src/db/client.js', () => ({
  createDb: vi.fn(() => currentDb),
}));

vi.mock('../src/auth.js', () => ({
  createAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn(async () =>
        currentUser ? { user: currentUser } : null,
      ),
    },
    handler: vi.fn(async () => new Response('auth')),
  })),
}));

vi.mock('../src/email.js', () => ({
  sendInvitationEmail: vi.fn(async () => undefined),
}));

function createFakeDb(
  options: { select?: unknown[][]; execute?: unknown[][] } = {},
) {
  const writes: WriteOperation[] = [];
  const selectQueue = [...(options.select ?? [])];
  const executeQueue = [...(options.execute ?? [])];

  return {
    writes,
    select() {
      const result = selectQueue.shift() ?? [];
      return queryBuilder(result);
    },
    insert(table: unknown) {
      return writeBuilder(writes, { table });
    },
    update(table: unknown) {
      return writeBuilder(writes, { table });
    },
    execute: vi.fn(async () => executeQueue.shift() ?? [{ ok: 1 }]),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        select() {
          const result = selectQueue.shift() ?? [];
          return queryBuilder(result);
        },
        insert(table: unknown) {
          return writeBuilder(writes, { table });
        },
        update(table: unknown) {
          return writeBuilder(writes, { table });
        },
        execute: vi.fn(async () => [{ ok: 1 }]),
      }),
    ),
  };
}

function queryBuilder(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are awaited directly.
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  return builder;
}

function writeBuilder(writes: WriteOperation[], operation: WriteOperation) {
  const builder = {
    values: vi.fn((values: unknown) => {
      operation.values = values;
      return builder;
    }),
    set: vi.fn((set: unknown) => {
      operation.set = set;
      return builder;
    }),
    where: vi.fn(() => builder),
    returning: vi.fn((projection?: unknown) => {
      operation.returning = projection;
      writes.push(operation);
      return Promise.resolve([materializeWrite(operation)]);
    }),
    // biome-ignore lint/suspicious/noThenProperty: Drizzle update builders can be awaited without returning().
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      writes.push(operation);
      return Promise.resolve([]).then(resolve, reject);
    },
  };

  return builder;
}

function materializeWrite(operation: WriteOperation) {
  const payload =
    (operation.values as Record<string, unknown> | undefined) ??
    (operation.set as Record<string, unknown> | undefined) ??
    {};

  return {
    id: crypto.randomUUID(),
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    updatedAt: new Date('2026-05-22T00:00:00.000Z'),
    ...payload,
  };
}

async function loadApp() {
  const module = await import('../src/index.js');
  return module.default;
}

function jsonRequest(path: string, body?: unknown, init?: RequestInit) {
  return new Request(`http://localhost${path}`, {
    method: init?.method ?? 'GET',
    headers:
      body === undefined
        ? init?.headers
        : { 'content-type': 'application/json', ...init?.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function membership(role: 'owner' | 'admin' | 'editor' | 'viewer' | 'runner') {
  return {
    id: `${role}-membership`,
    orgId: 'org-1',
    userId: currentUser?.id ?? ownerUser.id,
    role,
    invitedActorType: 'user',
    invitedActorId: ownerUser.id,
    invitedAt: new Date('2026-05-22T00:00:00.000Z'),
    joinedAt: new Date('2026-05-22T00:00:00.000Z'),
    removedAt: null,
  };
}

function makeLogic(overrides: Partial<Logic> = {}): Logic {
  return {
    version: '2',
    name: 'Approval',
    description: 'Approval logic',
    entryTableId: 't1',
    fieldDefs: {
      f1: { id: 'f1', name: 'Amount', type: 'number' },
    },
    tables: {
      t1: {
        id: 't1',
        name: 'Main',
        cols: [{ id: 'c1', fieldId: 'f1' }],
        outputCols: [{ id: 'oc1', name: 'Decision' }],
        rows: [
          {
            id: 'r1',
            cells: { c1: { op: '<=', val: '100' } },
            conclusion: {
              type: 'terminal',
              outputs: { oc1: 'approve' },
            },
          },
        ],
      },
    },
    nField: 2,
    nTable: 2,
    nCol: 2,
    nOCol: 2,
    nRow: 2,
    ...overrides,
  };
}

function makeLogicRow(data = makeLogic()) {
  return {
    id: 'logic-1',
    workspaceId: 'workspace-1',
    slug: 'approval',
    name: 'Approval',
    description: null,
    draftData: data,
    draftSchemaVersion: '2',
    draftRevision: 3,
    productionVersionId: 'version-2',
    draftUpdatedAt: new Date('2026-05-22T00:00:00.000Z'),
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    updatedAt: new Date('2026-05-22T00:00:00.000Z'),
    deletedAt: null,
  };
}

function makeWorkspaceRow() {
  return {
    id: 'workspace-1',
    orgId: 'org-1',
    deletedAt: null,
  };
}

function makeVersionRow(versionNumber = 2) {
  return {
    id: `version-${versionNumber}`,
    workspaceId: 'workspace-1',
    logicId: 'logic-1',
    versionNumber,
    schemaVersion: '2',
    releaseNotes: null,
    publishedAt: new Date('2026-05-22T00:00:00.000Z'),
    publishedActorType: 'user',
    publishedActorId: ownerUser.id,
  };
}

beforeEach(() => {
  currentUser = ownerUser;
  currentDb = createFakeDb();
});

describe('org route behavior', () => {
  it('returns 401 from /api/me when no session is present', async () => {
    currentUser = null;
    currentDb = createFakeDb();
    const app = await loadApp();

    const response = await app.fetch(jsonRequest('/api/me'), baseEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'unauthorized' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('creates an org, owner membership, default workspace, and audit event', async () => {
    currentUser = ownerUser;
    currentDb = createFakeDb();
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/orgs',
        { name: 'Acme Ops', slug: 'Acme Ops!' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.org).toMatchObject({
      name: 'Acme Ops',
      slug: 'acme-ops',
      createdActorType: 'user',
      createdActorId: ownerUser.id,
    });
    expect(body.membership).toMatchObject({
      orgId: body.org.id,
      userId: ownerUser.id,
      role: 'owner',
    });
    expect(body.defaultWorkspace).toMatchObject({
      orgId: body.org.id,
      slug: 'default',
      name: 'Default workspace',
    });
    expect(currentDb.writes).toHaveLength(4);
    expect(currentDb.writes[3]?.values).toMatchObject({
      orgId: body.org.id,
      actorUserId: ownerUser.id,
      action: 'org.created',
      targetType: 'org',
      targetId: body.org.id,
    });
  });

  it('prevents non-managers from inviting members', async () => {
    currentUser = editorUser;
    currentDb = createFakeDb({ select: [[membership('editor')]] });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/orgs/org-1/invitations',
        { email: 'new@example.test', role: 'viewer' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(403);
    expect(currentDb.writes).toHaveLength(0);
  });

  it('previews an invitation for onboarding without requiring sign-in', async () => {
    currentUser = null;
    currentDb = createFakeDb({
      select: [
        [
          {
            id: 'invitation-1',
            email: 'invited@example.test',
            role: 'editor',
            expiresAt: new Date('2099-06-01T00:00:00.000Z'),
            acceptedAt: null,
            revokedAt: null,
            orgName: 'Acme Ops',
          },
        ],
        [{ id: invitedUser.id }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest('/api/invitations/preview?token=invite-token'),
      baseEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      invitation: {
        email: 'invited@example.test',
        role: 'editor',
        status: 'pending',
      },
      org: { name: 'Acme Ops' },
      authHint: {
        invitedEmailHasAccount: true,
        currentUserEmail: null,
        currentUserMatchesInvitation: false,
      },
    });
  });

  it('previews expired and revoked invitation terminal states', async () => {
    currentUser = null;
    currentDb = createFakeDb({
      select: [
        [
          {
            id: 'expired-invitation',
            email: 'expired@example.test',
            role: 'runner',
            expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            acceptedAt: null,
            revokedAt: null,
            orgName: 'Acme Ops',
          },
        ],
        [],
      ],
    });
    const app = await loadApp();

    const expiredResponse = await app.fetch(
      jsonRequest('/api/invitations/preview?token=expired-token'),
      baseEnv,
    );

    expect(expiredResponse.status).toBe(200);
    await expect(expiredResponse.json()).resolves.toMatchObject({
      invitation: { status: 'expired' },
    });

    currentDb = createFakeDb({
      select: [
        [
          {
            id: 'revoked-invitation',
            email: 'revoked@example.test',
            role: 'viewer',
            expiresAt: new Date('2099-06-01T00:00:00.000Z'),
            acceptedAt: null,
            revokedAt: new Date('2026-05-22T00:00:00.000Z'),
            orgName: 'Acme Ops',
          },
        ],
        [],
      ],
    });

    const revokedResponse = await app.fetch(
      jsonRequest('/api/invitations/preview?token=revoked-token'),
      baseEnv,
    );

    expect(revokedResponse.status).toBe(200);
    await expect(revokedResponse.json()).resolves.toMatchObject({
      invitation: { status: 'revoked' },
    });
  });

  it('accepts an invitation by adding an existing user to the invited org', async () => {
    currentUser = invitedUser;
    currentDb = createFakeDb({
      select: [
        [
          {
            id: 'invitation-1',
            orgId: 'org-2',
            email: invitedUser.email,
            role: 'editor',
            tokenDigest: 'digest',
            expiresAt: new Date('2099-06-01T00:00:00.000Z'),
            acceptedAt: null,
            revokedAt: null,
            invitedActorType: 'user',
            invitedActorId: ownerUser.id,
          },
        ],
        [],
        [
          {
            id: 'org-2',
            slug: 'acme-ops',
            name: 'Acme Ops',
            plan: 'free',
          },
        ],
        [
          {
            id: 'workspace-2',
            orgId: 'org-2',
            slug: 'default',
            name: 'Default workspace',
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/invitations/accept',
        { token: 'invite-token' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.membership).toMatchObject({
      orgId: 'org-2',
      userId: invitedUser.id,
      role: 'editor',
    });
    expect(body.org).toMatchObject({
      id: 'org-2',
      name: 'Acme Ops',
    });
    expect(body.defaultWorkspace).toMatchObject({
      id: 'workspace-2',
      orgId: 'org-2',
    });
    expect(currentDb.transaction).not.toHaveBeenCalled();
    expect(currentDb.writes[0]?.values).toMatchObject({
      orgId: 'org-2',
      userId: invitedUser.id,
      role: 'editor',
    });
    expect(currentDb.writes[1]?.set).toMatchObject({
      acceptedActorType: 'user',
      acceptedActorId: invitedUser.id,
    });
  });

  it('rejects invitation accept when the signed-in email differs', async () => {
    currentUser = editorUser;
    currentDb = createFakeDb({
      select: [
        [
          {
            id: 'invitation-1',
            orgId: 'org-2',
            email: invitedUser.email,
            role: 'editor',
            tokenDigest: 'digest',
            expiresAt: new Date('2099-06-01T00:00:00.000Z'),
            acceptedAt: null,
            revokedAt: null,
            invitedActorType: 'user',
            invitedActorId: ownerUser.id,
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/invitations/accept',
        { token: 'invite-token' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'email_mismatch' },
    });
    expect(currentDb.transaction).not.toHaveBeenCalled();
    expect(currentDb.writes).toHaveLength(0);
  });
});

describe('workspace route behavior', () => {
  it('requires editor role or higher when creating workspaces', async () => {
    currentDb = createFakeDb({ select: [[membership('viewer')]] });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/orgs/org-1/workspaces',
        { name: 'Claims' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(403);
    expect(currentDb.writes).toHaveLength(0);
  });

  it('creates workspaces with normalized slugs and writes an audit event', async () => {
    currentDb = createFakeDb({ select: [[membership('editor')]] });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/orgs/org-1/workspaces',
        {
          name: 'Claims Review',
          slug: ' Claims Review ',
          description: 'Review flow',
        },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.workspace).toMatchObject({
      orgId: 'org-1',
      name: 'Claims Review',
      slug: 'claims-review',
      description: 'Review flow',
      createdActorId: ownerUser.id,
    });
    expect(currentDb.writes).toHaveLength(2);
    expect(currentDb.writes[1]?.values).toMatchObject({
      orgId: 'org-1',
      workspaceId: body.workspace.id,
      actorUserId: ownerUser.id,
      actorPersona: 'author',
      action: 'workspace.created',
    });
  });
});

describe('logic route behavior', () => {
  it('rejects invalid Logic JSON before inserting a logic draft', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            id: 'workspace-1',
            orgId: 'org-1',
            deletedAt: null,
          },
        ],
        [membership('editor')],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/workspaces/workspace-1/logics',
        { name: 'Broken', data: { version: '2' } },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_logic' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('creates a validated logic draft with canonical schema metadata', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            id: 'workspace-1',
            orgId: 'org-1',
            deletedAt: null,
          },
        ],
        [membership('editor')],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/workspaces/workspace-1/logics',
        {
          name: 'Approval',
          slug: 'Approval Logic',
          description: 'Cloud draft',
          data,
        },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.logic).toMatchObject({
      workspaceId: 'workspace-1',
      slug: 'approval-logic',
      name: 'Approval',
      description: 'Cloud draft',
      draftData: data,
      draftSchemaVersion: '2',
      draftRevision: 1,
    });
    expect(currentDb.writes).toHaveLength(2);
    expect(currentDb.writes[1]?.values).toMatchObject({
      orgId: 'org-1',
      workspaceId: 'workspace-1',
      action: 'logic.created',
      targetType: 'logic',
      targetId: body.logic.id,
    });
  });

  it('returns a draft revision conflict before writing stale draft updates', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            logic: {
              id: 'logic-1',
              workspaceId: 'workspace-1',
              draftRevision: 3,
              draftData: data,
              deletedAt: null,
            },
            workspace: {
              id: 'workspace-1',
              orgId: 'org-1',
              deletedAt: null,
            },
          },
        ],
        [membership('editor')],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/logics/logic-1',
        { draftRevision: 2, data },
        { method: 'PATCH' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'draft_revision_conflict' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('returns a stable runner URL for the production version', async () => {
    currentDb = createFakeDb({
      select: [
        [{ logic: makeLogicRow(), workspace: makeWorkspaceRow() }],
        [membership('editor')],
        [makeVersionRow(2)],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest('/api/logics/logic-1/runner-share', {}, { method: 'POST' }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runnerUrl: 'http://localhost:8787/run/workspace-1/logic-1@v2',
      runnerPath: '/run/workspace-1/logic-1@v2',
      version: { id: 'version-2', versionNumber: 2 },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('creates a runner invitation that returns to the shared runner URL', async () => {
    currentDb = createFakeDb({
      select: [
        [{ logic: makeLogicRow(), workspace: makeWorkspaceRow() }],
        [membership('editor')],
        [makeVersionRow(3)],
        [{ id: 'org-1', name: 'Acme Ops' }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/logics/logic-1/runner-share',
        {
          email: 'Runner@Example.Test',
          role: 'runner',
          versionNumber: 3,
        },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      runnerUrl: 'http://localhost:8787/run/workspace-1/logic-1@v3',
      runnerPath: '/run/workspace-1/logic-1@v3',
      invitation: {
        email: 'runner@example.test',
        role: 'runner',
      },
      version: { id: 'version-3', versionNumber: 3 },
    });
    expect(body.acceptUrl).toContain('/invite?token=');
    expect(body.acceptUrl).toContain(
      'redirect=%2Frun%2Fworkspace-1%2Flogic-1%40v3',
    );
    expect(currentDb.writes[1]?.values).toMatchObject({
      orgId: 'org-1',
      email: 'runner@example.test',
      role: 'runner',
      invitedActorId: ownerUser.id,
    });
    expect(currentDb.writes[2]?.values).toMatchObject({
      orgId: 'org-1',
      workspaceId: 'workspace-1',
      action: 'runner_share.invitation_created',
      targetType: 'invitation',
      metadata: {
        email: 'runner@example.test',
        role: 'runner',
        logicId: 'logic-1',
        versionNumber: 3,
      },
    });
  });

  it('requires a published version before sharing a runner', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            logic: { ...makeLogicRow(), productionVersionId: null },
            workspace: makeWorkspaceRow(),
          },
        ],
        [membership('editor')],
        [],
        [],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest('/api/logics/logic-1/runner-share', {}, { method: 'POST' }),
      baseEnv,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'no_published_version' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('publishes the draft and pins production by default', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            logic: {
              id: 'logic-1',
              workspaceId: 'workspace-1',
              slug: 'approval',
              name: 'Approval',
              description: null,
              draftData: data,
              draftSchemaVersion: '2',
              draftRevision: 3,
              productionVersionId: null,
              draftUpdatedAt: new Date('2026-05-22T00:00:00.000Z'),
              createdAt: new Date('2026-05-22T00:00:00.000Z'),
              updatedAt: new Date('2026-05-22T00:00:00.000Z'),
              deletedAt: null,
            },
            workspace: {
              id: 'workspace-1',
              orgId: 'org-1',
              deletedAt: null,
            },
          },
        ],
        [membership('editor')],
      ],
      execute: [
        [
          {
            version_id: 'version-2',
            version_workspace_id: 'workspace-1',
            version_logic_id: 'logic-1',
            version_number: 2,
            version_schema_version: '2',
            version_release_notes: 'Ready',
            version_published_at: new Date('2026-05-22T00:00:00.000Z'),
            version_published_actor_type: 'user',
            version_published_actor_id: ownerUser.id,
            logic_id: 'logic-1',
            logic_workspace_id: 'workspace-1',
            logic_slug: 'approval',
            logic_name: 'Approval',
            logic_description: null,
            logic_draft_data: data,
            logic_draft_schema_version: '2',
            logic_draft_revision: 3,
            logic_production_version_id: 'version-2',
            logic_draft_updated_at: new Date('2026-05-22T00:00:00.000Z'),
            logic_created_at: new Date('2026-05-22T00:00:00.000Z'),
            logic_updated_at: new Date('2026-05-22T00:00:00.000Z'),
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/logics/logic-1/publish',
        { releaseNotes: 'Ready' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.version).toMatchObject({
      workspaceId: 'workspace-1',
      logicId: 'logic-1',
      versionNumber: 2,
      schemaVersion: '2',
      releaseNotes: 'Ready',
      publishedActorType: 'user',
      publishedActorId: ownerUser.id,
    });
    expect(body.logic).toMatchObject({
      id: 'logic-1',
      productionVersionId: body.version.id,
    });
    expect(currentDb.writes).toHaveLength(1);
    expect(currentDb.writes[0]?.values).toMatchObject({
      orgId: 'org-1',
      workspaceId: 'workspace-1',
      action: 'logic.published_to_production',
      targetType: 'logic_version',
      targetId: body.version.id,
      metadata: { logicId: 'logic-1', versionNumber: 2 },
    });
  });
});
