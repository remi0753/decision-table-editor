import { lazy, Suspense, useEffect } from 'react';
import { toast } from 'sonner';
import { AccessPage } from '@/components/access/AccessPage';
import { AuthPage } from '@/components/auth/AuthPage';
import { InvitePage } from '@/components/invite/InvitePage';
import { AppLayout } from '@/components/layout/AppLayout';
import { RunnerPage } from '@/components/runner/RunnerPage';
import { OrgSettingsPage } from '@/components/settings/OrgSettingsPage';
import { WorkspaceSettingsPage } from '@/components/settings/WorkspaceSettingsPage';
import { loadFromStorage } from '@/hooks/useLocalStorage';
import { useUndoRedoShortcuts } from '@/hooks/useUndoRedoShortcuts';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { clearHistory } from '@/store/historyStore';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

// The marketing top page only ships with the cloud (leverie.dev) build. In the
// bundled flavor consumed by @leverie/server, `/` redirects straight to /edit
// and the TopPage chunk is never loaded.
const TopPage =
  import.meta.env.VITE_FLAVOR === 'bundled'
    ? null
    : lazy(() =>
        import('@/components/top/TopPage').then((m) => ({
          default: m.TopPage,
        })),
      );

function EditorApp() {
  const importLogic = useLogicStore((s) => s.importLogic);
  const logic = useLogicStore((s) => s.logic);
  const initializeCloud = useCloudStore((s) => s.initializeCloud);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const t = useT();

  useUndoRedoShortcuts();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    const isGuest = sessionStorage.getItem('leverie-editor-mode') === 'guest';
    const shouldMigrateLocalDraft =
      sessionStorage.getItem('leverie-migrate-local-draft') === '1';
    if (isGuest) {
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

    const localDraft = shouldMigrateLocalDraft ? loadFromStorage() : null;
    if (localDraft) {
      importLogic(localDraft);
    }

    toast.info(t.cloudChecking, { id: 'cloud-session-checking' });
    void initializeCloud(localDraft ?? logic, importLogic, {
      requireAuth: true,
      migrateLocalDraft: Boolean(localDraft),
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
      if (shouldMigrateLocalDraft) {
        sessionStorage.removeItem('leverie-migrate-local-draft');
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

export default function App() {
  if (window.location.pathname.startsWith('/run/')) return <RunnerPage />;
  if (window.location.pathname === '/invite') return <InvitePage />;
  if (window.location.pathname === '/settings/org') return <OrgSettingsPage />;
  if (window.location.pathname === '/settings/workspace') {
    return <WorkspaceSettingsPage />;
  }
  if (window.location.pathname === '/edit') return <EditorApp />;
  if (window.location.pathname === '/auth') return <AuthPage />;
  if (window.location.pathname === '/access') return <AccessPage />;
  if (TopPage === null) {
    window.location.replace('/edit');
    return null;
  }
  return (
    <Suspense fallback={null}>
      <TopPage />
    </Suspense>
  );
}
