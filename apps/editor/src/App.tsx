import { lazy, Suspense } from 'react';

// Every route is code-split so each page only ships its own JavaScript. The
// marketing top page (`/`) therefore loads just the TopPage chunk plus the
// shared React core, instead of the whole editor (table, graph, dnd-kit, …).
const TopPage = lazy(() =>
  import('@/components/top/TopPage').then((m) => ({ default: m.TopPage })),
);
// `/edit` and `/local` go through EditorRoute, a tiny wrapper that shows the
// mobile gate or the full editor based on viewport. Both the editor and the
// gate are split out of this wrapper, so a phone visitor never downloads the
// heavy editor chunk just to read the "use a desktop" page.
const EditorRoute = lazy(() => import('@/EditorRoute'));
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
const FactCatalogPage = lazy(() =>
  import('@/components/data/FactCatalogPage').then((m) => ({
    default: m.FactCatalogPage,
  })),
);
const ReferenceTablesPage = lazy(() =>
  import('@/components/data/ReferenceTablesPage').then((m) => ({
    default: m.ReferenceTablesPage,
  })),
);
const ResolverRecipePage = lazy(() =>
  import('@/components/data/ResolverRecipePage').then((m) => ({
    default: m.ResolverRecipePage,
  })),
);
const LogicBindingsPage = lazy(() =>
  import('@/components/data/LogicBindingsPage').then((m) => ({
    default: m.LogicBindingsPage,
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
  if (path === '/settings/data') return <FactCatalogPage />;
  if (path === '/settings/data/tables') return <ReferenceTablesPage />;
  if (path === '/settings/data/resolvers') return <ResolverRecipePage />;
  if (path === '/settings/data/bindings') return <LogicBindingsPage />;
  if (path === '/edit') return <EditorRoute />;
  // `/local` opens the editor in local mode regardless of any existing cloud
  // session: a stable, shareable/bookmarkable entry point that never depends on
  // a click handler running first (unlike a bare /edit link).
  if (path === '/local') return <EditorRoute forceLocal />;
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
