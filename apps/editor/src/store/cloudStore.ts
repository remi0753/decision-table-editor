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
    },
    localLogic: Logic,
    importLogic: (logic: Logic) => void,
  ) => Promise<void>;
  saveCloudDraft: (logic: Logic) => Promise<void>;
  publishCloudLogic: () => Promise<void>;
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

  initializeCloud: async (localLogic, importLogic, options) => {
    if (initializeRequest) return initializeRequest;

    initializeRequest = (async () => {
      set({ mode: 'checking', error: null });
      try {
        const me = await getMe();
        let orgs = me.orgs.map((membership) => membership.org);
        const roleByOrgId: Record<string, CloudRole> = Object.fromEntries(
          me.orgs.map(
            (membership) => [membership.org.id, membership.role] as const,
          ),
        );
        let org = orgs[0];
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
        const cloudLogic = cloudResult
          ? cloudResult.logic
          : (await createLogic(workspace.id, localLogic)).logic;

        importLogic(cloudLogic.draftData);
        set({
          mode: 'cloud',
          saveState: 'saved',
          user: me.user,
          org,
          orgRole: roleByOrgId[org.id] ?? null,
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

      let workspace = input.workspaceId
        ? choices.workspacesByOrgId[org.id]?.find(
            (candidate) => candidate.id === input.workspaceId,
          )
        : undefined;
      if (!workspace) {
        const created = await createWorkspace(org.id, 'Default workspace');
        workspace = created.workspace;
      }

      const cloudResult =
        input.logicId && input.logicId !== 'new'
          ? await getLogic(input.logicId)
          : null;
      const cloudLogic =
        cloudResult?.logic ??
        (await createLogic(workspace.id, localLogic)).logic;

      importLogic((cloudResult?.logic ?? cloudLogic).draftData);
      set({
        mode: 'cloud',
        saveState: 'saved',
        org,
        orgRole: choices.roleByOrgId[org.id] ?? null,
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

  saveCloudDraft: async (logic) => {
    const { logicId, draftRevision, mode } = get();
    if (mode !== 'cloud' || !logicId || draftRevision === null) return;

    set({ saveState: 'saving', error: null });
    try {
      const result = await saveDraft({ logicId, logic, draftRevision });
      set({
        saveState: 'saved',
        draftRevision: result.logic.draftRevision,
        latestVersion: null,
        productionVersion: null,
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

  publishCloudLogic: async () => {
    const { logicId, mode, saveState } = get();
    if (mode !== 'cloud' || !logicId || saveState === 'saving') return;

    set({ saveState: 'saving', error: null });
    try {
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
    await get().initializeCloud(localLogic, importLogic, { requireAuth: true });
  },

  signUp: async (name, email, password, localLogic, importLogic) => {
    await signUpEmail(name, email, password);
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
