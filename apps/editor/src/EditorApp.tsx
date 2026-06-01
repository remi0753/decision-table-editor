import { useEffect } from 'react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { loadFromStorage } from '@/hooks/useLocalStorage';
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
        // `id` dedupes the toast so a re-run of this mount effect (e.g. React
        // StrictMode's double invocation) shows a single banner, not two.
        toast.info(t.newLogicCreated, { id: 'new-logic-created' });
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

    // Cloud mode (`/edit`). Authentication just loads the cloud session and
    // opens the existing logic (or the new-logic screen for first-time users).
    // A local draft preserved at sign-in time is surfaced as an opt-in source
    // on the new-logic screen itself, not forced here.
    toast.info(t.cloudChecking, { id: 'cloud-session-checking' });
    void initializeCloud(logic, importLogic, {
      requireAuth: true,
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
      clearHistory();
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    setSelectedTable(logic.entryTableId);
  }, []);

  return <AppLayout localOnboardingEnabled={forceLocal} />;
}
