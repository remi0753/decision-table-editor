import { useEffect } from 'react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  clearMigrationDraft,
  loadFromStorage,
  loadMigrationDraft,
} from '@/hooks/useLocalStorage';
import { useUndoRedoShortcuts } from '@/hooks/useUndoRedoShortcuts';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { clearHistory } from '@/store/historyStore';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

export default function EditorApp({
  forceLocal = false,
}: {
  forceLocal?: boolean;
}) {
  const importLogic = useLogicStore((s) => s.importLogic);
  const logic = useLogicStore((s) => s.logic);
  const initializeCloud = useCloudStore((s) => s.initializeCloud);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const t = useT();

  useUndoRedoShortcuts();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    // Local mode (`/local`): open the editor without touching any cloud
    // session. The session cookie is left intact — it is simply ignored — so
    // returning to /edit later restores the cloud workspace. The working draft
    // lives in sessionStorage, so a fresh tab starts blank while a reload keeps
    // in-progress work.
    if (forceLocal) {
      const saved = loadFromStorage();
      if (saved) {
        importLogic(saved);
      } else {
        toast.info(t.newLogicCreated);
      }
      useCloudStore.setState({
        mode: 'local',
        saveState: 'idle',
        user: null,
        workspace: null,
        logicId: null,
        draftRevision: null,
        lastSavedAt: null,
        error: null,
      });
      clearHistory();
      return;
    }

    // Cloud mode (`/edit`). If a local draft was promoted for migration (e.g.
    // the user chose "move my draft" on the auth page), pick it up so it can be
    // saved into a new cloud logic.
    const migrationDraft = loadMigrationDraft();
    if (migrationDraft) {
      importLogic(migrationDraft);
    }

    toast.info(t.cloudChecking, { id: 'cloud-session-checking' });
    void initializeCloud(migrationDraft ?? logic, importLogic, {
      requireAuth: true,
      migrateLocalDraft: Boolean(migrationDraft),
    }).finally(() => {
      const cloud = useCloudStore.getState();
      if (
        cloud.mode === 'cloud' &&
        (cloud.orgRole === 'viewer' || cloud.orgRole === 'runner') &&
        cloud.workspace &&
        cloud.logicId
      ) {
        const version = cloud.productionVersion ?? cloud.latestVersion;
        if (version) {
          window.location.assign(
            `/run/${cloud.workspace.id}/${cloud.logicId}@v${version.versionNumber}`,
          );
          return;
        }
        window.location.assign('/access');
        return;
      }
      // The migration draft is now carried in the in-memory logic (and through
      // any workspace-selection step). Only clear the persistent slot once the
      // user is authenticated — a failed auth check redirects to /auth and we
      // want the draft to survive for the next attempt.
      if (cloud.mode === 'cloud' || cloud.mode === 'selecting') {
        clearMigrationDraft();
      }
      clearHistory();
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    setSelectedTable(logic.entryTableId);
  }, []);

  return <AppLayout />;
}
