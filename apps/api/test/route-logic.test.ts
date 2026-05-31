import type { Logic } from '@leverie/engine';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../../packages/server/src/password.js';

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
  HMAC_KEY_RING_JSON:
    '{"active":"v1","keys":{"v1":"abcdefghijklmnopqrstuvwxyz123456"}}',
};

let currentDb: FakeDb;
let currentUser: SessionUser | null;

vi.mock('../../../packages/server/src/db/client.js', () => ({
  createDb: vi.fn(() => currentDb),
}));

vi.mock('../../../packages/server/src/auth.js', () => ({
  createAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn(async () =>
        currentUser ? { user: currentUser } : null,
      ),
    },
    handler: vi.fn(async () => new Response('auth')),
  })),
}));

vi.mock('../../../packages/server/src/email.js', () => ({
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
    delete(table: unknown) {
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
        delete(table: unknown) {
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

function mockRandomSuffix(value = 1) {
  return vi
    .spyOn(crypto, 'getRandomValues')
    .mockImplementation((array: ArrayBufferView | null) => {
      if (array && 'fill' in array) {
        (array as Uint8Array).fill(value);
      }
      return array;
    });
}

async function loadApp() {
  const module = await import('../src/index.js');
  return module.app;
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
    slug: 'default',
    name: 'Default workspace',
    deletedAt: null,
  };
}

function makeApiKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'api-key-1',
    workspaceId: 'workspace-1',
    name: 'Production MCP',
    lookupSecretVersion: 'v1',
    lookupDigest: 'digest',
    keyHash: 'hash',
    keyPrefix: 'lvr_abcdef12',
    role: 'viewer',
    scopeMode: 'allowlist',
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    createdActorType: 'user',
    createdActorId: ownerUser.id,
    ...overrides,
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
  it('rejects sign-up when the email already belongs to a user', async () => {
    currentUser = null;
    currentDb = createFakeDb({
      select: [[{ id: ownerUser.id }]],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/auth/sign-up/email',
        {
          name: 'Duplicate',
          email: 'OWNER@example.test',
          password: 'correct horse battery staple',
        },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: 'USER_ALREADY_EXISTS',
      message: 'An account already exists for this email address.',
    });
    expect(currentDb.writes).toHaveLength(0);
  });

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

  it('auto-suffixes an org slug when the derived one already exists', async () => {
    currentUser = ownerUser;
    const random = mockRandomSuffix();
    currentDb = createFakeDb({
      select: [[], [{ id: 'existing-org' }], []],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest('/api/orgs', { name: 'My organization' }, { method: 'POST' }),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.org).toMatchObject({
      name: 'My organization',
      slug: 'my-organization-bbbbbbbb',
    });
    expect(currentDb.writes[0]?.values).toMatchObject({
      slug: 'my-organization-bbbbbbbb',
    });
    random.mockRestore();
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

  function ownerTarget() {
    return {
      id: 'owner-membership',
      orgId: 'org-1',
      userId: invitedUser.id,
      role: 'owner',
      invitedActorType: 'user',
      invitedActorId: ownerUser.id,
      invitedAt: new Date('2026-05-22T00:00:00.000Z'),
      joinedAt: new Date('2026-05-22T00:00:00.000Z'),
      removedAt: null,
    };
  }

  it('forbids an admin from demoting an owner', async () => {
    currentUser = editorUser; // membership role, not the user record, drives authz
    currentDb = createFakeDb({
      select: [[membership('admin')], [ownerTarget()]],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/orgs/org-1/members/owner-membership',
        { role: 'admin' },
        { method: 'PATCH' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(403);
    expect(currentDb.writes).toHaveLength(0);
  });

  it('forbids an admin from removing an owner', async () => {
    currentUser = editorUser;
    currentDb = createFakeDb({
      select: [[membership('admin')], [ownerTarget()]],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest('/api/orgs/org-1/members/owner-membership', undefined, {
        method: 'DELETE',
      }),
      baseEnv,
    );

    expect(response.status).toBe(403);
    expect(currentDb.writes).toHaveLength(0);
  });

  it('lets an admin change a non-owner member role', async () => {
    currentUser = editorUser;
    currentDb = createFakeDb({
      select: [
        [membership('admin')],
        [{ ...ownerTarget(), id: 'editor-membership', role: 'editor' }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/orgs/org-1/members/editor-membership',
        { role: 'viewer' },
        { method: 'PATCH' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(
      currentDb.writes.some(
        (w) => (w.set as { role?: string } | undefined)?.role === 'viewer',
      ),
    ).toBe(true);
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

describe('api key route behavior', () => {
  it('lets org owners issue scoped API keys and returns the secret once', async () => {
    currentUser = ownerUser;
    currentDb = createFakeDb({
      select: [
        [makeWorkspaceRow()],
        [membership('owner')],
        [{ id: 'logic-1' }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/workspaces/workspace-1/api-keys',
        {
          name: 'Production MCP',
          role: 'viewer',
          scopeMode: 'allowlist',
          logicIds: ['logic-1'],
        },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.secret).toMatch(/^lvr_/);
    expect(body.apiKey).toMatchObject({
      workspaceId: 'workspace-1',
      name: 'Production MCP',
      role: 'viewer',
      scopeMode: 'allowlist',
      logicIds: ['logic-1'],
      createdActorType: 'user',
      createdActorId: ownerUser.id,
    });
    expect(body.apiKey).not.toHaveProperty('lookupDigest');
    expect(body.apiKey).not.toHaveProperty('keyHash');
    expect(currentDb.writes[0]?.values).toMatchObject({
      workspaceId: 'workspace-1',
      name: 'Production MCP',
      role: 'viewer',
      scopeMode: 'allowlist',
      lookupSecretVersion: 'v1',
      createdActorId: ownerUser.id,
    });
    expect(currentDb.writes[1]?.values).toEqual([
      {
        workspaceId: 'workspace-1',
        apiKeyId: body.apiKey.id,
        logicId: 'logic-1',
      },
    ]);
    expect(currentDb.writes[2]?.values).toMatchObject({
      action: 'api_key.created',
      targetType: 'api_key',
      targetId: body.apiKey.id,
    });
  });

  it('prevents editors from managing API keys', async () => {
    currentUser = editorUser;
    currentDb = createFakeDb({
      select: [[makeWorkspaceRow()], [membership('editor')]],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/workspaces/workspace-1/api-keys',
        { name: 'Agent', role: 'runner', scopeMode: 'all' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(403);
    expect(currentDb.writes).toHaveLength(0);
  });

  it('rejects allow-list scopes containing logics outside the workspace', async () => {
    currentUser = ownerUser;
    currentDb = createFakeDb({
      select: [[makeWorkspaceRow()], [membership('owner')], []],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/workspaces/workspace-1/api-keys',
        {
          name: 'Bad scope',
          role: 'viewer',
          scopeMode: 'allowlist',
          logicIds: ['other-logic'],
        },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_scope',
        missingLogicIds: ['other-logic'],
      },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('revokes API keys without deleting historical rows', async () => {
    currentUser = ownerUser;
    currentDb = createFakeDb({
      select: [
        [{ apiKey: makeApiKeyRow(), workspace: makeWorkspaceRow() }],
        [membership('owner')],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest('/api/api-keys/api-key-1/revoke', {}, { method: 'POST' }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(currentDb.writes[0]?.set).toMatchObject({
      revokedAt: expect.any(Date),
    });
    expect(currentDb.writes[1]?.values).toMatchObject({
      action: 'api_key.revoked',
      targetType: 'api_key',
      targetId: 'api-key-1',
    });
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

  it('auto-suffixes a workspace slug when the derived one already exists', async () => {
    const random = mockRandomSuffix();
    currentDb = createFakeDb({
      select: [[membership('editor')], [{ value: 0 }], [{ id: 'workspace-1' }]],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/orgs/org-1/workspaces',
        { name: 'Claims Review' },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.workspace).toMatchObject({
      name: 'Claims Review',
      slug: 'claims-review-bbbbbbbb',
    });
    random.mockRestore();
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
        [{ value: 0 }],
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

  it('auto-suffixes the slug when the derived one collides with an existing logic in the workspace', async () => {
    const random = mockRandomSuffix();
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
        [{ value: 1 }],
        [{ slug: 'new-logic' }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/workspaces/workspace-1/logics',
        { name: 'New Logic', data: makeLogic() },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.logic).toMatchObject({
      slug: 'new-logic-bbbbbbbb',
      name: 'New Logic',
    });
    random.mockRestore();
  });

  it('blocks logic creation once the user has reached the per-account cap', async () => {
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
        [{ value: 3 }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      jsonRequest(
        '/api/workspaces/workspace-1/logics',
        { name: 'Fourth', data: makeLogic() },
        { method: 'POST' },
      ),
      baseEnv,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'logic_limit_reached' },
    });
    expect(currentDb.writes).toHaveLength(0);
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

describe('evaluate API (P4.2)', () => {
  const apiSecret = 'lvr_test_secret_token_abcdef0123456789';
  let apiKeyHash = '';

  beforeAll(async () => {
    apiKeyHash = await hashPassword(apiSecret);
  });

  function makeApiKeyForAuth(overrides: Record<string, unknown> = {}) {
    return makeApiKeyRow({
      keyHash: apiKeyHash,
      // The real lookupDigest is HMAC(secret); the route looks for an exact
      // (lookup_secret_version, lookup_digest) match in the SELECT result, so
      // queueing this fake row is what stands in for the digest match.
      ...overrides,
    });
  }

  function evaluateRequest(
    path: string,
    body: unknown,
    init?: { headers?: HeadersInit },
  ) {
    return new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiSecret}`,
        ...init?.headers,
      },
      body: JSON.stringify(body),
    });
  }

  it('rejects calls missing an Authorization header', async () => {
    currentDb = createFakeDb();
    const app = await loadApp();

    const response = await app.fetch(
      new Request('http://localhost/v1/logics/logic-1/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: {} }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'missing_authorization' },
    });
  });

  it('rejects API keys whose HMAC digest does not match any row', async () => {
    currentDb = createFakeDb({ select: [[]] });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate', {
        inputs: { Amount: 50 },
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_api_key' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('rejects revoked API keys without writing an execution_log', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({
              revokedAt: new Date('2026-05-01T00:00:00.000Z'),
            }),
            workspace: makeWorkspaceRow(),
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate', {
        inputs: { Amount: 50 },
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'api_key_revoked' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('blocks logics outside the allow-list scope before evaluating', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'allowlist' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        [makeLogicRow()],
        [], // empty scope lookup
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate', {
        inputs: { Amount: 50 },
      }),
      baseEnv,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'logic_not_in_scope' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('evaluates production by default and persists an ok execution_log', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        [makeLogicRow(data)],
        [{ ...makeVersionRow(2), data }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate', {
        inputs: { Amount: 50 },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      logic: { id: 'logic-1', slug: 'approval', name: 'Approval' },
      version: {
        id: 'version-2',
        versionNumber: 2,
        requestedType: 'production',
      },
      result: { status: 'ok', outputs: { Decision: 'approve' } },
    });
    expect(body.trace).toEqual([
      expect.objectContaining({
        table: 'Main',
        matchedRow: expect.objectContaining({
          index: 1,
          conclusion: 'terminal',
        }),
      }),
    ]);
    expect(typeof body.requestId).toBe('string');
    expect(typeof body.latencyMs).toBe('number');

    expect(currentDb.writes).toHaveLength(2);
    expect(currentDb.writes[0]?.values).toMatchObject({
      workspaceId: 'workspace-1',
      logicId: 'logic-1',
      logicVersionId: 'version-2',
      requestedVersionType: 'production',
      requestedVersionNumber: null,
      resolvedVersionNumber: 2,
      status: 'ok',
      callerActorType: 'api_key',
      callerChannel: 'api_key',
      callerApiKeyId: 'api-key-1',
    });
    expect(currentDb.writes[1]?.set).toMatchObject({
      lastUsedAt: expect.any(Date),
    });
  });

  it('returns no_match with unmatched table name when no row applies', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        [makeLogicRow(data)],
        [{ ...makeVersionRow(2), data }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      // Amount 500 > 100, no row matches `<= 100`
      evaluateRequest('/v1/logics/logic-1/evaluate?version=production', {
        inputs: { Amount: 500 },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result).toEqual({
      status: 'no_match',
      unmatchedTable: 'Main',
    });
    expect(currentDb.writes[0]?.values).toMatchObject({
      status: 'no_match',
      logicVersionId: 'version-2',
    });
  });

  it('resolves a pinned version number and reports requested type "version"', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        [makeLogicRow(data)],
        [{ ...makeVersionRow(3), data }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate?version=v3', {
        inputs: { Amount: 50 },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      version: { id: 'version-3', versionNumber: 3, requestedType: 'version' },
    });
    expect(currentDb.writes[0]?.values).toMatchObject({
      requestedVersionType: 'version',
      requestedVersionNumber: 3,
      resolvedVersionNumber: 3,
    });
  });

  it('rejects draft as a version target for API key callers', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        [makeLogicRow()],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate?version=draft', {
        inputs: {},
      }),
      baseEnv,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_version' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('returns 404 when production is not pinned', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        [{ ...makeLogicRow(), productionVersionId: null }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate', { inputs: {} }),
      baseEnv,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'no_published_version' },
    });
    expect(currentDb.writes).toHaveLength(0);
  });

  it('records an error execution_log when inputs are malformed', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        [makeLogicRow(data)],
        [{ ...makeVersionRow(2), data }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      evaluateRequest('/v1/logics/logic-1/evaluate', { notInputs: true }),
      baseEnv,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_inputs' },
    });
    expect(currentDb.writes).toHaveLength(1);
    expect(currentDb.writes[0]?.values).toMatchObject({
      status: 'error',
      errorCode: 'invalid_inputs',
      callerActorType: 'api_key',
      callerChannel: 'api_key',
      callerApiKeyId: 'api-key-1',
    });
  });
});

describe('hosted MCP API (P4.3)', () => {
  const apiSecret = 'lvr_test_secret_token_abcdef0123456789';
  let apiKeyHash = '';

  beforeAll(async () => {
    apiKeyHash = await hashPassword(apiSecret);
  });

  function makeApiKeyForAuth(overrides: Record<string, unknown> = {}) {
    return makeApiKeyRow({ keyHash: apiKeyHash, ...overrides });
  }

  function mcpRequest(body: unknown, init?: { headers?: HeadersInit }) {
    return new Request('http://localhost/v1/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiSecret}`,
        ...init?.headers,
      },
      body: JSON.stringify(body),
    });
  }

  it('rejects missing Authorization with a JSON-RPC-shaped error', async () => {
    currentDb = createFakeDb();
    const app = await loadApp();

    const response = await app.fetch(
      new Request('http://localhost/v1/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        data: { code: 'missing_authorization' },
      },
    });
  });

  it('returns server info on initialize and echoes a supported protocolVersion', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      mcpRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26' },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'leverie-mcp-hosted' },
      },
    });
  });

  it('lists accessible logics in scope=all mode with input/output JSON Schemas', async () => {
    const data = makeLogic();
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        // loadAccessibleLogics — scope=all path
        [
          {
            id: 'logic-1',
            workspaceId: 'workspace-1',
            slug: 'approval',
            name: 'Approval',
            description: null,
            productionVersionId: 'version-2',
          },
        ],
        // loadLogicVersionData
        [
          {
            id: 'version-2',
            versionNumber: 2,
            data,
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      mcpRequest({ jsonrpc: '2.0', id: 7, method: 'tools/list' }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 7,
      result: {
        tools: [
          expect.objectContaining({
            name: 'approval',
            description: expect.stringContaining('Version: v2 (production)'),
            inputSchema: expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                Amount: expect.objectContaining({ type: 'number' }),
              }),
            }),
            outputSchema: expect.objectContaining({
              oneOf: expect.any(Array),
            }),
          }),
        ],
      },
    });
  });

  it('hides logics with no pinned production version from tools/list', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        // No row passes the productionVersionId !== null filter.
        [
          {
            id: 'logic-1',
            workspaceId: 'workspace-1',
            slug: 'approval',
            name: 'Approval',
            description: null,
            productionVersionId: null,
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result).toEqual({ tools: [] });
  });

  it('evaluates tools/call against the production snapshot and records execution_log', async () => {
    const data = makeLogic();
    const logicMetaRow = {
      id: 'logic-1',
      workspaceId: 'workspace-1',
      slug: 'approval',
      name: 'Approval',
      description: null,
      productionVersionId: 'version-2',
    };
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        // tools/call → loadAccessibleLogics
        [logicMetaRow],
        // tools/call → loadLogicVersionData
        [{ id: 'version-2', versionNumber: 2, data }],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      mcpRequest({
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/call',
        params: {
          name: 'approval',
          arguments: { Amount: 50 },
        },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 42,
      result: {
        isError: false,
        structuredContent: {
          status: 'ok',
          outputs: { Decision: 'approve' },
        },
      },
    });
    expect(body.result.content[0]).toMatchObject({ type: 'text' });
    expect(currentDb.writes[0]?.values).toMatchObject({
      workspaceId: 'workspace-1',
      logicId: 'logic-1',
      logicVersionId: 'version-2',
      requestedVersionType: 'production',
      requestedVersionNumber: null,
      resolvedVersionNumber: 2,
      status: 'ok',
      callerActorType: 'api_key',
      callerChannel: 'api_key',
      callerApiKeyId: 'api-key-1',
    });
  });

  it('rejects unknown tool names with JSON-RPC invalid_params (no execution_log)', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
        // empty accessible logics → no match for the requested tool name
        [],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      mcpRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'does_not_exist', arguments: {} },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32602 },
    });
    // The only write is the best-effort api_key.last_used_at bump, which
    // happens after every authenticated request regardless of dispatch outcome.
    // execution_log must NOT be written for an unknown-tool rejection.
    const executionLogWrites = currentDb.writes.filter(
      (w) =>
        (w.values as { status?: string } | undefined)?.status !== undefined,
    );
    expect(executionLogWrites).toHaveLength(0);
  });

  it('returns method_not_found for unsupported methods', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      mcpRequest({ jsonrpc: '2.0', id: 9, method: 'resources/list' }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 9,
      error: { code: -32601 },
    });
  });

  it('returns 204 for notifications (no id)', async () => {
    currentDb = createFakeDb({
      select: [
        [
          {
            apiKey: makeApiKeyForAuth({ scopeMode: 'all' }),
            workspace: makeWorkspaceRow(),
          },
        ],
      ],
    });
    const app = await loadApp();

    const response = await app.fetch(
      mcpRequest({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
      baseEnv,
    );

    expect(response.status).toBe(204);
  });
});
