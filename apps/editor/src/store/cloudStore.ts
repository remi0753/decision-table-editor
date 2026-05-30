import type { Logic } from '@leverie/engine';
import { toast } from 'sonner';
import { create } from 'zustand';
import {
  CloudApiError,
  type CloudLogic,
  type CloudOrg,
  type CloudRole,
  type CloudUser,
  type CloudVersion,
  type CloudWorkspace,
  createLogic,
  createOrg,
  createWorkspace,
  getLogic,
  getMe,
  listLogics,
  listWorkspaces,
  publishLogic,
  saveDraft,
  signInEmail,
  signOut,
  signUpEmail,
} from '@/lib/cloudApi';

type CloudMode = 'checking' | 'local' | 'cloud' | 'selecting';
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type CloudChoices = {
  orgs: CloudOrg[];
  roleByOrgId: Record<string, CloudRole>;
  workspacesByOrgId: Record<string, CloudWorkspace[]>;
  logicsByWorkspaceId: Record<string, CloudLogic[]>;
  preferNewLogic?: boolean;
};

type CloudStore = {
  mode: CloudMode;
  saveState: SaveState;
  user: CloudUser | null;
  org: CloudOrg | null;
  orgRole: CloudRole | null;
  workspace: CloudWorkspace | null;
  choices: CloudChoices | null;
  logicId: string | null;
  draftRevision: number | null;
  latestVersion: CloudVersion | null;
  productionVersion: CloudVersion | null;
  lastSavedAt: Date | null;
  error: string | null;
  initializeCloud: (
    localLogic: Logic,
    importLogic: (logic: Logic) => void,
    options?: { requireAuth?: boolean; migrateLocalDraft?: boolean },
  ) => Promise<void>;
  selectCloudTarget: (
    input: {
      orgId: string;
      workspaceId?: string;
      logicId?: string | 'new';
      newLogic?: {
        name: string;
        slug: string;
        description?: string;
      };
    },
    localLogic: Logic,
    importLogic: (logic: Logic) => void,
  ) => Promise<void>;
  createCloudLogicFrom: (
    logic: Logic,
    options:
      | {
          name: string;
          slug: string;
          description?: string;
        }
      | undefined,
    importLogic: (logic: Logic) => void,
  ) => Promise<void>;
  switchCloudLogic: (
    logicId: string,
    importLogic: (logic: Logic) => void,
  ) => Promise<void>;
  saveCloudDraft: (logic: Logic) => Promise<void>;
  publishCloudLogic: (logic?: Logic) => Promise<void>;
  signIn: (
    email: string,
    password: string,
    localLogic: Logic,
    importLogic: (logic: Logic) => void,
  ) => Promise<void>;
  signUp: (
    name: string,
    email: string,
    password: string,
    localLogic: Logic,
    importLogic: (logic: Logic) => void,
  ) => Promise<void>;
  signOutToAuth: () => Promise<void>;
};

let initializeRequest: Promise<void> | null = null;

function apiErrorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Cloud request failed.';
}

function consumePreferredOrgId() {
  const orgId = sessionStorage.getItem('leverie-preferred-org-id');
  if (orgId) sessionStorage.removeItem('leverie-preferred-org-id');
  return orgId;
}

function canEditCloud(role: CloudRole | null | undefined) {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

function uniqueLogicName(baseName: string, existing: CloudLogic[]) {
  const names = new Set(existing.map((logic) => logic.name));
  if (!names.has(baseName)) return baseName;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${baseName} ${suffix}`;
    if (!names.has(candidate)) return candidate;
  }

  return `${baseName} ${Date.now()}`;
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

async function listLogicsByWorkspace(workspaces: CloudWorkspace[]) {
  const entries = await Promise.all(
    workspaces.map(async (workspace) => {
      const result = await listLogics(workspace.id);
      return [workspace.id, result.logics] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export const useCloudStore = create<CloudStore>((set, get) => ({
  mode: 'checking',
  saveState: 'idle',
  user: null,
  org: null,
  orgRole: null,
  workspace: null,
  logicId: null,
  draftRevision: null,
  latestVersion: null,
  productionVersion: null,
  lastSavedAt: null,
  error: null,
  choices: null,

  initializeCloud: async (_localLogic, importLogic, options) => {
    if (initializeRequest) return initializeRequest;

    initializeRequest = (async () => {
      set({ mode: 'checking', error: null });
      try {
        const me = await getMe();
        let orgs = me.orgs.map((membership) => membership.org);
        const preferredOrgId = consumePreferredOrgId();
        const roleByOrgId: Record<string, CloudRole> = Object.fromEntries(
          me.orgs.map(
            (membership) => [membership.org.id, membership.role] as const,
          ),
        );
        let org =
          orgs.find((candidate) => candidate.id === preferredOrgId) ?? orgs[0];
        if (!org && options?.requireAuth) {
          const created = await createOrg('My organization');
          org = created.org;
          orgs = [org];
          roleByOrgId[org.id] = 'owner';
        }
        if (!org) {
          set({
            mode: 'local',
            user: me.user,
            org: null,
            orgRole: null,
            choices: null,
            error: null,
          });
          return;
        }

        const workspaceEntries = await Promise.all(
          orgs.map(async (candidateOrg) => {
            const result = await listWorkspaces(candidateOrg.id);
            return [candidateOrg.id, result.workspaces] as const;
          }),
        );
        const workspacesByOrgId = Object.fromEntries(workspaceEntries);

        if (orgs.length > 1) {
          const logicsByWorkspaceId = await listLogicsByWorkspace(
            Object.values(workspacesByOrgId).flat(),
          );
          if (
            preferredOrgId &&
            workspacesByOrgId[preferredOrgId]?.length === 1
          ) {
            const preferredOrg = orgs.find(
              (candidate) => candidate.id === preferredOrgId,
            );
            const preferredWorkspace = workspacesByOrgId[preferredOrgId]?.[0];
            if (preferredOrg && preferredWorkspace) {
              const logics = logicsByWorkspaceId[preferredWorkspace.id] ?? [];
              const logicSummary = options?.migrateLocalDraft
                ? undefined
                : logics[0];
              const cloudResult = logicSummary
                ? await getLogic(logicSummary.id)
                : null;
              const preferredRole = roleByOrgId[preferredOrg.id] ?? null;
              if (!cloudResult && !canEditCloud(preferredRole)) {
                set({
                  mode: 'selecting',
                  user: me.user,
                  org: preferredOrg,
                  choices: {
                    orgs,
                    roleByOrgId,
                    workspacesByOrgId,
                    logicsByWorkspaceId,
                    preferNewLogic: false,
                  },
                  error: null,
                });
                return;
              }
              if (!cloudResult) {
                set({
                  mode: 'selecting',
                  user: me.user,
                  org: preferredOrg,
                  choices: {
                    orgs,
                    roleByOrgId,
                    workspacesByOrgId,
                    logicsByWorkspaceId,
                    preferNewLogic: true,
                  },
                  error: null,
                });
                return;
              }
              const cloudLogic = cloudResult.logic;
              importLogic(cloudLogic.draftData);
              set({
                mode: 'cloud',
                saveState: 'saved',
                user: me.user,
                org: preferredOrg,
                orgRole: roleByOrgId[preferredOrg.id] ?? null,
                workspace: preferredWorkspace,
                choices: null,
                logicId: cloudLogic.id,
                draftRevision: cloudLogic.draftRevision,
                latestVersion: cloudResult?.latestVersion ?? null,
                productionVersion: cloudResult?.productionVersion ?? null,
                lastSavedAt: new Date(),
                error: null,
              });
              return;
            }
          }
          set({
            mode: 'selecting',
            user: me.user,
            org: null,
            choices: {
              orgs,
              roleByOrgId,
              workspacesByOrgId,
              logicsByWorkspaceId,
              preferNewLogic: options?.migrateLocalDraft,
            },
            error: null,
          });
          return;
        }

        let workspace = workspacesByOrgId[org.id]?.[0];
        if (!workspace && options?.requireAuth) {
          const created = await createWorkspace(org.id, 'Default workspace');
          workspace = created.workspace;
          workspacesByOrgId[org.id] = [workspace];
        }
        if (!workspace) {
          set({
            mode: 'local',
            user: me.user,
            org: null,
            orgRole: null,
            choices: null,
            error: null,
          });
          return;
        }

        if ((workspacesByOrgId[org.id]?.length ?? 0) > 1) {
          const logicsByWorkspaceId = await listLogicsByWorkspace(
            workspacesByOrgId[org.id] ?? [],
          );
          set({
            mode: 'selecting',
            user: me.user,
            org,
            choices: {
              orgs,
              roleByOrgId,
              workspacesByOrgId,
              logicsByWorkspaceId,
              preferNewLogic: options?.migrateLocalDraft,
            },
            error: null,
          });
          return;
        }

        const logics = await listLogics(workspace.id);
        if (logics.logics.length > 1) {
          set({
            mode: 'selecting',
            user: me.user,
            org,
            choices: {
              orgs,
              roleByOrgId,
              workspacesByOrgId,
              logicsByWorkspaceId: { [workspace.id]: logics.logics },
            },
            error: null,
          });
          return;
        }

        const logicSummary = options?.migrateLocalDraft
          ? undefined
          : logics.logics[0];
        const cloudResult = logicSummary
          ? await getLogic(logicSummary.id)
          : null;
        const orgRole = roleByOrgId[org.id] ?? null;
        if (!cloudResult && !canEditCloud(orgRole)) {
          set({
            mode: 'selecting',
            user: me.user,
            org,
            orgRole,
            choices: {
              orgs,
              roleByOrgId,
              workspacesByOrgId,
              logicsByWorkspaceId: { [workspace.id]: logics.logics },
              preferNewLogic: false,
            },
            error: null,
          });
          return;
        }
        if (!cloudResult) {
          set({
            mode: 'selecting',
            user: me.user,
            org,
            orgRole,
            choices: {
              orgs,
              roleByOrgId,
              workspacesByOrgId,
              logicsByWorkspaceId: { [workspace.id]: logics.logics },
              preferNewLogic: true,
            },
            error: null,
          });
          return;
        }
        const cloudLogic = cloudResult.logic;

        importLogic(cloudLogic.draftData);
        set({
          mode: 'cloud',
          saveState: 'saved',
          user: me.user,
          org,
          orgRole,
          workspace,
          choices: null,
          logicId: cloudLogic.id,
          draftRevision: cloudLogic.draftRevision,
          latestVersion: cloudResult?.latestVersion ?? null,
          productionVersion: cloudResult?.productionVersion ?? null,
          lastSavedAt: new Date(),
          error: null,
        });
        if (options?.migrateLocalDraft) {
          toast.success('Local draft moved to cloud.');
        }
      } catch (error) {
        if (options?.requireAuth) {
          set({ mode: 'checking', error: apiErrorMessage(error) });
          window.location.assign('/auth');
          return;
        }

        if (error instanceof CloudApiError && error.status === 401) {
          set({
            mode: 'local',
            user: null,
            org: null,
            orgRole: null,
            workspace: null,
            choices: null,
            logicId: null,
            draftRevision: null,
            latestVersion: null,
            productionVersion: null,
            error: null,
          });
          return;
        }

        set({
          mode: 'local',
          org: null,
          orgRole: null,
          choices: null,
          latestVersion: null,
          productionVersion: null,
          error: apiErrorMessage(error),
        });
      } finally {
        initializeRequest = null;
      }
    })();

    return initializeRequest;
  },

  selectCloudTarget: async (input, localLogic, importLogic) => {
    const { choices } = get();
    if (!choices) return;

    set({ saveState: 'saving', error: null });
    try {
      const org = choices.orgs.find(
        (candidate) => candidate.id === input.orgId,
      );
      if (!org)
        throw new Error('Selected organization is no longer available.');
      const orgRole = choices.roleByOrgId[org.id] ?? null;

      let workspace = input.workspaceId
        ? choices.workspacesByOrgId[org.id]?.find(
            (candidate) => candidate.id === input.workspaceId,
          )
        : undefined;
      if (!workspace) {
        if (!canEditCloud(orgRole)) {
          throw new Error('Ask an editor for a Runner link to open.');
        }
        const created = await createWorkspace(org.id, 'Default workspace');
        workspace = created.workspace;
      }

      const cloudResult =
        input.logicId && input.logicId !== 'new'
          ? await getLogic(input.logicId)
          : null;
      if (!cloudResult && !canEditCloud(orgRole)) {
        throw new Error('Ask an editor for a Runner link to open.');
      }
      const newLogicInput = input.newLogic;
      const nextLogic =
        !cloudResult && newLogicInput
          ? {
              ...localLogic,
              name: newLogicInput.name,
              description: newLogicInput.description || undefined,
            }
          : localLogic;
      const cloudLogic =
        cloudResult?.logic ??
        (
          await createLogic(workspace.id, nextLogic, {
            slug: newLogicInput?.slug,
          })
        ).logic;

      importLogic((cloudResult?.logic ?? cloudLogic).draftData);
      set({
        mode: 'cloud',
        saveState: 'saved',
        org,
        orgRole,
        workspace,
        choices: null,
        logicId: (cloudResult?.logic ?? cloudLogic).id,
        draftRevision: (cloudResult?.logic ?? cloudLogic).draftRevision,
        latestVersion: cloudResult?.latestVersion ?? null,
        productionVersion: cloudResult?.productionVersion ?? null,
        lastSavedAt: new Date(),
        error: null,
      });
      toast.success('Cloud workspace connected.');
    } catch (error) {
      const message = apiErrorMessage(error);
      set({ saveState: 'error', error: message });
      toast.error(message);
    }
  },

  createCloudLogicFrom: async (logic, options, importLogic) => {
    const { mode, workspace } = get();
    if (mode !== 'cloud' || !workspace) {
      importLogic(
        options
          ? {
              ...logic,
              name: options.name,
              description: options.description || undefined,
            }
          : logic,
      );
      set({
        mode: 'local',
        saveState: 'idle',
        logicId: null,
        draftRevision: null,
        latestVersion: null,
        productionVersion: null,
        lastSavedAt: null,
        error: null,
      });
      return;
    }

    set({ saveState: 'saving', error: null });
    try {
      const existing = await listLogics(workspace.id);
      const nextLogic = {
        ...logic,
        name: options?.name ?? uniqueLogicName(logic.name, existing.logics),
        description: options?.description || logic.description,
      };
      const result = await createLogic(workspace.id, nextLogic, {
        slug: options?.slug ?? normalizeSlug(nextLogic.name),
      });
      importLogic(result.logic.draftData);
      set({
        mode: 'cloud',
        saveState: 'saved',
        logicId: result.logic.id,
        draftRevision: result.logic.draftRevision,
        latestVersion: null,
        productionVersion: null,
        lastSavedAt: new Date(),
        error: null,
      });
      toast.success('Created a new cloud logic.');
    } catch (error) {
      const message = apiErrorMessage(error);
      set({ saveState: 'error', error: message });
      toast.error(message);
    }
  },

  switchCloudLogic: async (logicId, importLogic) => {
    set({ saveState: 'saving', error: null });
    try {
      const cloudResult = await getLogic(logicId);
      importLogic(cloudResult.logic.draftData);
      set({
        mode: 'cloud',
        saveState: 'saved',
        logicId: cloudResult.logic.id,
        draftRevision: cloudResult.logic.draftRevision,
        latestVersion: cloudResult.latestVersion,
        productionVersion: cloudResult.productionVersion,
        lastSavedAt: new Date(),
        error: null,
      });
      toast.success('Logic switched.');
    } catch (error) {
      set({ saveState: 'error', error: apiErrorMessage(error) });
      toast.error(apiErrorMessage(error));
    }
  },

  saveCloudDraft: async (logic) => {
    const { logicId, draftRevision, mode } = get();
    if (mode !== 'cloud' || !logicId || draftRevision === null) return;

    set({ saveState: 'saving', error: null });
    try {
      const result = await saveDraft({ logicId, logic, draftRevision });
      set({
        saveState: 'saved',
        draftRevision: result.logic.draftRevision,
        lastSavedAt: new Date(),
        error: null,
      });
    } catch (error) {
      if (error instanceof CloudApiError && error.status === 409) {
        set({ saveState: 'conflict', error: error.message });
        toast.error(
          'Cloud draft changed elsewhere. Reload before editing more.',
        );
        return;
      }
      set({ saveState: 'error', error: apiErrorMessage(error) });
    }
  },

  publishCloudLogic: async (currentLogic) => {
    const { logicId, mode, saveState } = get();
    if (mode !== 'cloud' || !logicId || saveState === 'saving') return;

    set({ saveState: 'saving', error: null });
    try {
      if (currentLogic) {
        const { draftRevision } = get();
        if (draftRevision === null) {
          throw new Error('Cloud draft revision is missing.');
        }
        const saved = await saveDraft({
          logicId,
          logic: currentLogic,
          draftRevision,
        });
        set({
          draftRevision: saved.logic.draftRevision,
          lastSavedAt: new Date(),
        });
      }
      const result = await publishLogic(logicId);
      set({
        saveState: 'saved',
        draftRevision: result.logic.draftRevision,
        latestVersion: result.version,
        productionVersion: result.version,
        lastSavedAt: new Date(),
        error: null,
      });
      toast.success(`Published v${result.version.versionNumber}.`);
    } catch (error) {
      const message = apiErrorMessage(error);
      set({ saveState: 'error', error: message });
      toast.error(message);
    }
  },

  signIn: async (email, password, localLogic, importLogic) => {
    await signInEmail(email, password);
    sessionStorage.removeItem('leverie-editor-mode');
    await get().initializeCloud(localLogic, importLogic, { requireAuth: true });
  },

  signUp: async (name, email, password, localLogic, importLogic) => {
    // With email verification required, sign-up returns no session — the user
    // must click the link in the verification email before initializeCloud
    // can fetch /api/me. Callers should drive a "check your email" UI rather
    // than relying on this method to land the user inside the editor.
    await signUpEmail(name, email, password, `${window.location.origin}/edit`);
    sessionStorage.removeItem('leverie-editor-mode');
    const me = await getMe().catch(() => null);
    if (me && me.orgs.length === 0) {
      await createOrg(name || 'My organization');
    }
    await get().initializeCloud(localLogic, importLogic, { requireAuth: true });
  },

  signOutToAuth: async () => {
    await signOut().catch(() => undefined);
    set({
      mode: 'local',
      saveState: 'idle',
      user: null,
      org: null,
      orgRole: null,
      workspace: null,
      choices: null,
      logicId: null,
      draftRevision: null,
      latestVersion: null,
      productionVersion: null,
      lastSavedAt: null,
      error: null,
    });
    window.location.assign('/auth');
  },
}));
