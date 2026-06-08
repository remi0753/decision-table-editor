import type { Logic } from '@leverie/engine';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export type CloudUser = {
  id: string;
  email: string;
  name?: string | null;
};

export type CloudOrgMembership = {
  membershipId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'runner';
  joinedAt: string;
  org: CloudOrg;
};

export type CloudRole = CloudOrgMembership['role'];

export type CloudOrg = {
  id: string;
  slug: string;
  name: string;
  plan: string;
};

export type CloudWorkspace = {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  description?: string | null;
};

export type CloudLogic = {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description?: string | null;
  draftData: Logic;
  draftRevision: number;
  productionVersionId?: string | null;
  productionVersionNumber?: number | null;
  // Whether the requesting member may delete this logic. Present on list
  // responses so the UI can show a delete affordance only where allowed.
  canDelete?: boolean;
};

// The per-user logic cap usage, as returned by GET /api/me/logics. Backs the
// "X of N slots used" indicator and counts the user's own creations globally.
export type CloudMyLogics = {
  used: number;
  limit: number;
};

export type CloudVersion = {
  id: string;
  logicId: string;
  versionNumber: number;
  publishedAt: string;
};

export type CloudLogicDiffSource =
  | {
      type: 'draft';
      label: 'draft';
      data: Logic;
      draftRevision: number;
      updatedAt: string;
    }
  | {
      type: 'version';
      label: 'latest' | 'production' | `v${number}`;
      data: Logic;
      versionNumber: number;
      versionId: string;
      publishedAt: string;
    };

export type CloudJsonDiffChange = {
  path: string[];
  type: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
};

export type CloudMember = {
  membershipId: string;
  role: CloudRole;
  joinedAt: string;
  userId: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export type CloudInvitation = {
  id: string;
  orgId?: string;
  email: string;
  role: CloudRole;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type CloudApiKeyRole = Extract<
  CloudRole,
  'editor' | 'viewer' | 'runner'
>;

export type CloudApiKeyScopeMode = 'all' | 'allowlist';

export type CloudApiKey = {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  role: CloudApiKeyRole;
  scopeMode: CloudApiKeyScopeMode;
  logicIds: string[];
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type CreateApiKeyResponse = {
  apiKey: CloudApiKey;
  secret: string;
};

export type InvitationPreview = {
  invitation: {
    email: string;
    role: CloudRole;
    expiresAt: string;
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
  };
  org: {
    name: string;
  };
  authHint: {
    currentUserEmail: string | null;
    currentUserMatchesInvitation: boolean;
  };
};

export type AcceptInvitationResponse = {
  invitation: CloudInvitation & {
    orgId: string;
    acceptedAt: string;
  };
  membership: {
    id: string;
    orgId: string;
    userId: string;
    role: CloudRole;
  };
  org: CloudOrg | null;
  defaultWorkspace: CloudWorkspace | null;
};

export type RunnerVersion = CloudVersion & {
  workspaceId: string;
  schemaVersion: string;
  releaseNotes?: string | null;
  data: Logic;
};

export type RunnerLogicResponse = {
  workspace: CloudWorkspace;
  logic: CloudLogic;
  version: RunnerVersion;
  runner: {
    role: CloudRole;
    canEdit: boolean;
  };
};

export type RunnerShareRole = Extract<CloudRole, 'viewer' | 'runner'>;

export type RunnerShareResponse = {
  runnerUrl: string;
  runnerPath: string;
  version: CloudVersion;
  invitation?: CloudInvitation;
  acceptUrl?: string;
};

export class CloudApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Our routes nest the error as { error: { code, message } }; Better Auth's
    // handler returns { code, message } at the top level. Try both shapes.
    const code = data?.error?.code ?? data?.code ?? 'request_failed';
    const message =
      data?.error?.message ??
      data?.message ??
      `Request failed with ${res.status}`;
    throw new CloudApiError(res.status, code, message);
  }
  if (data === null) {
    throw new CloudApiError(
      res.status,
      'invalid_response',
      'Invalid API response.',
    );
  }
  return data as T;
}

export async function getMe() {
  return api<{ user: CloudUser; orgs: CloudOrgMembership[] }>('/api/me');
}

export async function listWorkspaces(orgId: string) {
  return api<{ workspaces: CloudWorkspace[] }>(`/api/orgs/${orgId}/workspaces`);
}

export async function listMembers(orgId: string) {
  return api<{ members: CloudMember[] }>(`/api/orgs/${orgId}/members`);
}

export async function updateMemberRole(
  orgId: string,
  membershipId: string,
  role: CloudRole,
) {
  return api<{ membership: { id: string; role: CloudRole } }>(
    `/api/orgs/${orgId}/members/${membershipId}`,
    {
      method: 'PATCH',
      body: { role },
    },
  );
}

export async function removeMember(orgId: string, membershipId: string) {
  return api<{ membership: { id: string; removedAt: string } }>(
    `/api/orgs/${orgId}/members/${membershipId}`,
    { method: 'DELETE' },
  );
}

export async function listInvitations(orgId: string) {
  return api<{ invitations: CloudInvitation[] }>(
    `/api/orgs/${orgId}/invitations`,
  );
}

export async function createInvitation(
  orgId: string,
  email: string,
  role: Exclude<CloudRole, 'owner'>,
) {
  return api<{ invitation: CloudInvitation; acceptUrl?: string }>(
    `/api/orgs/${orgId}/invitations`,
    {
      method: 'POST',
      body: { email, role },
    },
  );
}

export async function revokeInvitation(orgId: string, invitationId: string) {
  return api<{ invitation: CloudInvitation }>(
    `/api/orgs/${orgId}/invitations/${invitationId}/revoke`,
    { method: 'POST' },
  );
}

export async function previewInvitation(token: string) {
  return api<InvitationPreview>(
    `/api/invitations/preview?token=${encodeURIComponent(token)}`,
  );
}

export async function acceptInvitation(token: string) {
  return api<AcceptInvitationResponse>('/api/invitations/accept', {
    method: 'POST',
    body: { token },
  });
}

export async function createOrg(name: string) {
  return api<{
    org: CloudOrgMembership['org'];
    defaultWorkspace: CloudWorkspace;
  }>('/api/orgs', {
    method: 'POST',
    body: { name },
  });
}

export async function updateOrg(
  orgId: string,
  input: { name?: string; slug?: string },
) {
  return api<{ org: CloudOrg }>(`/api/orgs/${orgId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function createWorkspace(orgId: string, name: string) {
  return api<{ workspace: CloudWorkspace }>(`/api/orgs/${orgId}/workspaces`, {
    method: 'POST',
    body: { name },
  });
}

export async function updateWorkspace(
  workspaceId: string,
  input: { name?: string; description?: string | null },
) {
  return api<{ workspace: CloudWorkspace }>(`/api/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function listLogics(workspaceId: string) {
  return api<{ logics: CloudLogic[] }>(`/api/workspaces/${workspaceId}/logics`);
}

export async function listApiKeys(workspaceId: string) {
  return api<{ apiKeys: CloudApiKey[] }>(
    `/api/workspaces/${workspaceId}/api-keys`,
  );
}

export async function createApiKey(input: {
  workspaceId: string;
  name: string;
  role: CloudApiKeyRole;
  scopeMode: CloudApiKeyScopeMode;
  logicIds: string[];
}) {
  return api<CreateApiKeyResponse>(
    `/api/workspaces/${input.workspaceId}/api-keys`,
    {
      method: 'POST',
      body: {
        name: input.name,
        role: input.role,
        scopeMode: input.scopeMode,
        logicIds: input.logicIds,
      },
    },
  );
}

export async function revokeApiKey(apiKeyId: string) {
  return api<{ apiKey: CloudApiKey }>(`/api/api-keys/${apiKeyId}/revoke`, {
    method: 'POST',
    body: {},
  });
}

export async function createLogic(
  workspaceId: string,
  logic: Logic,
  options: { slug?: string } = {},
) {
  return api<{ logic: CloudLogic }>(`/api/workspaces/${workspaceId}/logics`, {
    method: 'POST',
    body: {
      name: logic.name,
      slug: options.slug,
      description: logic.description,
      data: logic,
    },
  });
}

export async function getLogic(logicId: string) {
  return api<{
    logic: CloudLogic;
    latestVersion: CloudVersion | null;
    productionVersion: CloudVersion | null;
  }>(`/api/logics/${logicId}`);
}

export async function getMyLogics() {
  return api<CloudMyLogics>('/api/me/logics');
}

export async function getLogicVersion(logicId: string, versionNumber: number) {
  return api<{ version: CloudVersion & { data: Logic } }>(
    `/api/logics/${logicId}/versions/${versionNumber}`,
  );
}

export async function deleteLogic(logicId: string) {
  // Send an empty JSON body so the request carries Content-Type: application/json.
  // The CSRF guard rejects state-changing requests that have a body (browsers
  // send Content-Length: 0 on DELETE) without a JSON content type (415).
  return api<{ logic: CloudLogic }>(`/api/logics/${logicId}`, {
    method: 'DELETE',
    body: {},
  });
}

export async function getRunnerLogic(
  workspaceId: string,
  logicId: string,
  versionNumber: number,
) {
  return api<RunnerLogicResponse>(
    `/api/run/${workspaceId}/${logicId}@v${versionNumber}`,
  );
}

export async function saveDraft(input: {
  logicId: string;
  logic: Logic;
  draftRevision: number;
}) {
  return api<{ logic: CloudLogic }>(`/api/logics/${input.logicId}`, {
    method: 'PATCH',
    body: {
      name: input.logic.name,
      description: input.logic.description,
      data: input.logic,
      draftRevision: input.draftRevision,
    },
  });
}

export async function publishLogic(logicId: string) {
  return api<{ logic: CloudLogic; version: CloudVersion }>(
    `/api/logics/${logicId}/publish`,
    {
      method: 'POST',
      body: { pinProduction: true },
    },
  );
}

export async function getLogicDiff(
  logicId: string,
  from = 'production',
  to = 'draft',
) {
  const params = new URLSearchParams({ from, to });
  return api<{
    from: CloudLogicDiffSource;
    to: CloudLogicDiffSource;
    equal: boolean;
    changes: CloudJsonDiffChange[];
  }>(`/api/logics/${logicId}/diff?${params.toString()}`);
}

export async function shareRunner(input: {
  logicId: string;
  email?: string;
  role?: RunnerShareRole;
  versionNumber?: number;
}) {
  return api<RunnerShareResponse>(`/api/logics/${input.logicId}/runner-share`, {
    method: 'POST',
    body: {
      email: input.email,
      role: input.role,
      versionNumber: input.versionNumber,
    },
  });
}

export async function signInEmail(email: string, password: string) {
  return api('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password },
  });
}

export async function signUpEmail(
  name: string,
  email: string,
  password: string,
  callbackURL: string,
) {
  return api('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name, email, password, callbackURL },
  });
}

export async function sendVerificationEmail(
  email: string,
  callbackURL: string,
) {
  return api('/api/auth/send-verification-email', {
    method: 'POST',
    body: { email, callbackURL },
  });
}

export async function signOut() {
  // Pass an empty object so the api helper sets Content-Type: application/json —
  // Better Auth's POST /sign-out rejects requests without it (415).
  return api('/api/auth/sign-out', { method: 'POST', body: {} });
}
