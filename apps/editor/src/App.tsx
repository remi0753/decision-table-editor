import { lazy, Suspense } from 'react';

// Every route is code-split so each page only ships its own JavaScript. The
// marketing top page (`/`) therefore loads just the TopPage chunk plus the
// shared React core, instead of the whole editor (table, graph, dnd-kit, …).
const TopPage = lazy(() =>
  import('@/components/top/TopPage').then((m) => ({ default: m.TopPage })),
);
const EditorApp = lazy(() => import('@/EditorApp'));
const RunnerPage = lazy(() =>
  import('@/components/runner/RunnerPage').then((m) => ({
    default: m.RunnerPage,
  })),
);
const InvitePage = lazy(() =>
  import('@/components/invite/InvitePage').then((m) => ({
    default: m.InvitePage,
  })),
);
const OrgSettingsPage = lazy(() =>
  import('@/components/settings/OrgSettingsPage').then((m) => ({
    default: m.OrgSettingsPage,
  })),
);
const WorkspaceSettingsPage = lazy(() =>
  import('@/components/settings/WorkspaceSettingsPage').then((m) => ({
    default: m.WorkspaceSettingsPage,
  })),
);
const AuthPage = lazy(() =>
  import('@/components/auth/AuthPage').then((m) => ({ default: m.AuthPage })),
);
const AccessPage = lazy(() =>
  import('@/components/access/AccessPage').then((m) => ({
    default: m.AccessPage,
  })),
);

// The marketing top page only ships with the cloud (leverie.dev) build. In the
// bundled flavor consumed by @leverie/server, `/` redirects straight to /edit.
const hasTopPage = import.meta.env.VITE_FLAVOR !== 'bundled';

function route() {
  const path = window.location.pathname;
  if (path.startsWith('/run/')) return <RunnerPage />;
  if (path === '/invite') return <InvitePage />;
  if (path === '/settings/org') return <OrgSettingsPage />;
  if (path === '/settings/workspace') return <WorkspaceSettingsPage />;
  if (path === '/edit') return <EditorApp />;
  // `/local` opens the editor in local mode regardless of any existing cloud
  // session: a stable, shareable/bookmarkable entry point that never depends on
  // a click handler running first (unlike a bare /edit link).
  if (path === '/local') return <EditorApp forceLocal />;
  if (path === '/auth') return <AuthPage />;
  if (path === '/access') return <AccessPage />;
  if (!hasTopPage) {
    window.location.replace('/edit');
    return null;
  }
  return <TopPage />;
}

export default function App() {
  return <Suspense fallback={null}>{route()}</Suspense>;
}
