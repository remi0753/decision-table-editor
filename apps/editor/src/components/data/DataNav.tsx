import { Database, Table2, Workflow } from 'lucide-react';

type DataTab = 'facts' | 'tables' | 'resolvers';

const TABS: {
  id: DataTab;
  label: string;
  path: string;
  icon: typeof Database;
}[] = [
  { id: 'facts', label: 'Facts', path: '/settings/data', icon: Database },
  {
    id: 'tables',
    label: 'Reference tables',
    path: '/settings/data/tables',
    icon: Table2,
  },
  {
    id: 'resolvers',
    label: 'Resolvers',
    path: '/settings/data/resolvers',
    icon: Workflow,
  },
];

// Shared sub-navigation for the data-definition area. Each tab links to its
// route, carrying the selected workspace so the target page opens in context.
export function DataNav({
  active,
  workspaceId,
}: {
  active: DataTab;
  workspaceId: string;
}) {
  const suffix = workspaceId ? `?workspaceId=${workspaceId}` : '';
  return (
    <div className="mb-5 inline-flex rounded border border-line bg-surface p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <a
            key={tab.id}
            href={`${tab.path}${suffix}`}
            className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium ${
              isActive
                ? 'bg-brand text-white'
                : 'text-fg-muted hover:bg-surface-muted'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
