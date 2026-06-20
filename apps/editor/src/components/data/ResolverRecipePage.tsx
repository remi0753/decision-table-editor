import {
  ArrowLeft,
  Ban,
  Boxes,
  Loader2,
  Play,
  Plus,
  Workflow,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { DataNav } from '@/components/data/DataNav';
import { ResolverEditorDialog } from '@/components/data/ResolverEditorDialog';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useConfirm } from '@/hooks/useConfirm';
import {
  CloudApiError,
  type CloudFact,
  type CloudOrg,
  type CloudReferenceTable,
  type CloudResolver,
  type CloudWorkspace,
  disableResolver,
  getMe,
  listFacts,
  listReferenceTables,
  listResolvers,
  listWorkspaces,
  type ReferenceLookupValue,
  testResolver,
} from '@/lib/cloudApi';

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Request failed.';
}

export function ResolverRecipePage() {
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orgs, setOrgs] = useState<CloudOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [resolvers, setResolvers] = useState<CloudResolver[]>([]);
  const [tables, setTables] = useState<CloudReferenceTable[]>([]);
  const [facts, setFacts] = useState<CloudFact[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [testTarget, setTestTarget] = useState<CloudResolver | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const tableName = useCallback(
    (dataSourceId: string) =>
      tables.find((t) => t.id === dataSourceId)?.name ?? 'Unknown table',
    [tables],
  );

  const loadData = useCallback(async (workspaceId: string, spinner = true) => {
    if (!workspaceId) {
      setResolvers([]);
      setTables([]);
      setFacts([]);
      return;
    }
    if (spinner) setRefreshing(true);
    try {
      const [resolverResult, tableResult, factResult] = await Promise.all([
        listResolvers(workspaceId),
        listReferenceTables(workspaceId),
        listFacts(workspaceId),
      ]);
      setResolvers(resolverResult.resolvers);
      setTables(tableResult.referenceTables);
      setFacts(factResult.facts);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (spinner) setRefreshing(false);
    }
  }, []);

  const loadWorkspacesForOrg = useCallback(
    async (orgId: string, preferredWorkspaceId?: string) => {
      const result = await listWorkspaces(orgId);
      setWorkspaces(result.workspaces);
      const nextId =
        result.workspaces.find((w) => w.id === preferredWorkspaceId)?.id ??
        result.workspaces[0]?.id ??
        '';
      setSelectedWorkspaceId(nextId);
      await loadData(nextId, false);
    },
    [loadData],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        const memberOrgs = me.orgs.map((m) => m.org);
        setOrgs(memberOrgs);
        const firstOrgId = memberOrgs[0]?.id ?? '';
        setSelectedOrgId(firstOrgId);
        const preferred =
          new URLSearchParams(window.location.search).get('workspaceId') ??
          undefined;
        if (firstOrgId) await loadWorkspacesForOrg(firstOrgId, preferred);
      } catch (error) {
        toast.error(errorMessage(error));
        if (error instanceof CloudApiError && error.status === 401) {
          window.location.assign('/auth');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWorkspacesForOrg]);

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    setRefreshing(true);
    try {
      await loadWorkspacesForOrg(orgId);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisable = async (resolver: CloudResolver) => {
    if (
      !(await confirm({
        title: 'Disable resolver',
        description: `Disable "${resolver.name}"? It will stop resolving facts.`,
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await disableResolver(resolver.id);
      toast.success('Resolver disabled.');
      await loadData(selectedWorkspaceId);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-surface-muted text-fg">
      <Toaster position="top-right" richColors />
      <header className="flex h-14 items-center justify-between border-b border-brand-border bg-gradient-to-r from-brand-subtle to-surface px-4">
        <a href="/edit" className="inline-flex items-center gap-3">
          <img src={logoUrl} alt="LEVERIE" className="h-9" />
        </a>
        <div className="inline-flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/edit"
            className="inline-flex h-8 items-center gap-2 rounded border border-line px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to editor
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded border border-brand-border bg-brand-subtle text-brand-fg">
              <Workflow className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-fg">Resolvers</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
              Recipes that fetch facts from a reference table when a key is
              known. Bind logic fields to the resolved facts, then publish.
            </p>
          </div>

          {orgs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-56">
                <span className="mb-1 block text-xs font-medium text-fg-muted">
                  Organization
                </span>
                <select
                  value={selectedOrgId}
                  onChange={(event) => void handleOrgChange(event.target.value)}
                  className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                >
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-56">
                <span className="mb-1 block text-xs font-medium text-fg-muted">
                  Workspace
                </span>
                <select
                  value={selectedWorkspaceId}
                  onChange={(event) =>
                    void (async () => {
                      setSelectedWorkspaceId(event.target.value);
                      await loadData(event.target.value);
                    })()
                  }
                  className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <DataNav active="resolvers" workspaceId={selectedWorkspaceId} />

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded border border-line bg-surface">
            <Loader2 className="h-5 w-5 animate-spin text-fg-faint" />
          </div>
        ) : !selectedWorkspace ? (
          <section className="rounded border border-line bg-surface p-8 text-center">
            <Boxes className="mx-auto h-8 w-8 text-fg-faint" />
            <h2 className="mt-3 text-base font-semibold text-fg">
              No workspace selected
            </h2>
          </section>
        ) : (
          <section className="rounded border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-fg-faint" />
                <h2 className="text-sm font-semibold text-fg">
                  {resolvers.length} resolver
                  {resolvers.length === 1 ? '' : 's'}
                </h2>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-fg-faint" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setShowEditor(true)}
                className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
              >
                <Plus className="h-4 w-4" />
                New resolver
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line-subtle bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Reference table</th>
                    <th className="px-4 py-2">Outputs</th>
                    <th className="px-4 py-2">Fallback</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="w-24 px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-fg-subtle"
                      >
                        No resolvers yet. Create one to resolve facts from a
                        reference table.
                      </td>
                    </tr>
                  ) : (
                    resolvers.map((resolver) => (
                      <tr
                        key={resolver.id}
                        className="border-b border-line-subtle last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-fg">
                          {resolver.name}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {tableName(resolver.dataSourceId)}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {resolver.outputMappings.length}
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-subtle">
                          {resolver.fallbackPolicy}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              resolver.status === 'active'
                                ? 'bg-success-bg text-success-fg'
                                : 'bg-surface-subtle text-fg-subtle'
                            }`}
                          >
                            {resolver.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setTestTarget(resolver)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
                              aria-label={`Test ${resolver.name}`}
                            >
                              <Play className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDisable(resolver)}
                              disabled={resolver.status !== 'active'}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:border-danger-border hover:bg-danger-bg hover:text-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Disable ${resolver.name}`}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {showEditor && selectedWorkspaceId ? (
        <ResolverEditorDialog
          workspaceId={selectedWorkspaceId}
          tables={tables}
          facts={facts}
          onClose={() => setShowEditor(false)}
          onCreated={() => {
            setShowEditor(false);
            void loadData(selectedWorkspaceId);
          }}
        />
      ) : null}

      {testTarget ? (
        <ResolverTestDialog
          resolver={testTarget}
          facts={facts}
          onClose={() => setTestTarget(null)}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}

function ResolverTestDialog({
  resolver,
  facts,
  onClose,
}: {
  resolver: CloudResolver;
  facts: CloudFact[];
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    matched: boolean;
    values: ReferenceLookupValue[];
    missingKeys: string[];
  } | null>(null);

  const factName = (factId: string) =>
    facts.find((f) => f.id === factId)?.name ?? factId;

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const factInputs = resolver.inputFactIds
        .map((factId) => ({ factId, value: values[factId] ?? '' }))
        .filter((entry) => entry.value !== '');
      const res = await testResolver(resolver.id, factInputs);
      setResult(res);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">
            Test resolver — {resolver.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {resolver.inputFactIds.map((factId) => (
            <label key={factId} className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                {factName(factId)}
              </span>
              <input
                value={values[factId] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [factId]: event.target.value,
                  }))
                }
                className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={running}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-ink px-3 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run resolver
          </button>

          {result ? (
            result.matched ? (
              <div className="rounded border border-line">
                <div className="border-b border-line-subtle bg-success-bg px-3 py-2 text-xs font-medium text-success-fg">
                  Matched — {result.values.length} resolved value(s)
                </div>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {result.values.map((value) => (
                      <tr
                        key={value.factId}
                        className="border-b border-line-subtle last:border-0"
                      >
                        <td className="px-3 py-2 text-fg-muted">
                          {factName(value.factId)}
                        </td>
                        <td className="px-3 py-2 font-medium text-fg">
                          {value.value ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-fg-subtle">
                          {value.state}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg">
                {result.missingKeys.length > 0
                  ? `Missing key values for: ${result.missingKeys.join(', ')}.`
                  : 'No row matched those keys.'}
              </p>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
