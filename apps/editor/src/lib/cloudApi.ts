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
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'runner';
  org: CloudOrg;
};

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
};

export type CloudVersion = {
  id: string;
  logicId: string;
  versionNumber: number;
  publishedAt: string;
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
    const error = data?.error;
    throw new CloudApiError(
      res.status,
      error?.code ?? 'request_failed',
      error?.message ?? `Request failed with ${res.status}`,
    );
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

export async function createOrg(name: string) {
  return api<{
    org: CloudOrgMembership['org'];
    defaultWorkspace: CloudWorkspace;
  }>('/api/orgs', {
    method: 'POST',
    body: { name },
  });
}

export async function createWorkspace(orgId: string, name: string) {
  return api<{ workspace: CloudWorkspace }>(`/api/orgs/${orgId}/workspaces`, {
    method: 'POST',
    body: { name },
  });
}

export async function listLogics(workspaceId: string) {
  return api<{ logics: CloudLogic[] }>(`/api/workspaces/${workspaceId}/logics`);
}

export async function createLogic(workspaceId: string, logic: Logic) {
  return api<{ logic: CloudLogic }>(`/api/workspaces/${workspaceId}/logics`, {
    method: 'POST',
    body: {
      name: logic.name,
      description: logic.description,
      data: logic,
    },
  });
}

export async function getLogic(logicId: string) {
  return api<{ logic: CloudLogic; latestVersion: CloudVersion | null }>(
    `/api/logics/${logicId}`,
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
) {
  return api('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name, email, password },
  });
}

export async function signOut() {
  return api('/api/auth/sign-out', { method: 'POST' });
}
