import type { Logic } from '@leverie/engine';
import { toast } from 'sonner';
import { create } from 'zustand';
import {
  CloudApiError,
  type CloudLogic,
  type CloudOrg,
  type CloudUser,
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
  workspacesByOrgId: Record<string, CloudWorkspace[]>;
  logicsByWorkspaceId: Record<string, CloudLogic[]>;
  preferNewLogic?: boolean;
};

type CloudStore = {
  mode: CloudMode;
  saveState: SaveState;
  user: CloudUser | null;
  org: CloudOrg | null;
  workspace: CloudWorkspace | null;
  choices: CloudChoices | null;
  logicId: string | null;
  draftRevision: number | null;
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
  workspace: null,
  logicId: null,
  draftRevision: null,
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
        let org = orgs[0];
        if (!org && options?.requireAuth) {
          const created = await createOrg('My organization');
          org = created.org;
          orgs = [org];
        }
        if (!org) {
          set({
            mode: 'local',
            user: me.user,
            org: null,
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
        const cloudLogic = logicSummary
          ? (await getLogic(logicSummary.id)).logic
          : (await createLogic(workspace.id, localLogic)).logic;

        importLogic(cloudLogic.draftData);
        set({
          mode: 'cloud',
          saveState: 'saved',
          user: me.user,
          org,
          workspace,
          choices: null,
          logicId: cloudLogic.id,
          draftRevision: cloudLogic.draftRevision,
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
            workspace: null,
            choices: null,
            logicId: null,
            draftRevision: null,
            error: null,
          });
          return;
        }

        set({
          mode: 'local',
          org: null,
          choices: null,
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

      const cloudLogic =
        input.logicId && input.logicId !== 'new'
          ? (await getLogic(input.logicId)).logic
          : (await createLogic(workspace.id, localLogic)).logic;

      importLogic(cloudLogic.draftData);
      set({
        mode: 'cloud',
        saveState: 'saved',
        org,
        workspace,
        choices: null,
        logicId: cloudLogic.id,
        draftRevision: cloudLogic.draftRevision,
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
      workspace: null,
      choices: null,
      logicId: null,
      draftRevision: null,
      lastSavedAt: null,
      error: null,
    });
    window.location.assign('/auth');
  },
}));
