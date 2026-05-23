import { useEffect } from 'react';
import { toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { AccessPage } from '@/components/access/AccessPage';
import { AuthPage } from '@/components/auth/AuthPage';
import { InvitePage } from '@/components/invite/InvitePage';
import { AppLayout } from '@/components/layout/AppLayout';
import { RunnerPage } from '@/components/runner/RunnerPage';
import { OrgSettingsPage } from '@/components/settings/OrgSettingsPage';
import { loadFromStorage } from '@/hooks/useLocalStorage';
import { useUndoRedoShortcuts } from '@/hooks/useUndoRedoShortcuts';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { clearHistory } from '@/store/historyStore';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

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

function TopPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="flex h-14 items-center justify-between border-b border-violet-200 bg-gradient-to-r from-violet-50 to-white px-4">
        <img src={logoUrl} alt="LEVERIE" className="h-9" />
        <div className="flex items-center gap-2">
          <a
            href="/auth"
            className="rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign in
          </a>
          <a
            href="/edit"
            onClick={() => {
              sessionStorage.setItem('leverie-editor-mode', 'guest');
            }}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            Try editor
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="text-4xl font-semibold text-gray-950">LEVERIE</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
          Build deterministic decision tools for AI agents, in tables, not code.
        </p>
      </main>
    </div>
  );
}

export default function App() {
  if (window.location.pathname.startsWith('/run/')) return <RunnerPage />;
  if (window.location.pathname === '/invite') return <InvitePage />;
  if (window.location.pathname === '/settings/org') return <OrgSettingsPage />;
  if (window.location.pathname === '/edit') return <EditorApp />;
  if (window.location.pathname === '/auth') return <AuthPage />;
  if (window.location.pathname === '/access') return <AccessPage />;
  return <TopPage />;
}
