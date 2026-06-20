import {
  ArrowLeft,
  Ban,
  Boxes,
  Database,
  Loader2,
  Pencil,
  Plus,
  Tag,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { DataNav } from '@/components/data/DataNav';
import { FactEditorDialog } from '@/components/data/FactEditorDialog';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useConfirm } from '@/hooks/useConfirm';
import {
  CloudApiError,
  type CloudFact,
  type CloudOrg,
  type CloudWorkspace,
  createFact,
  deprecateFact,
  type FactInput,
  getMe,
  listFacts,
  listWorkspaces,
  updateFact,
} from '@/lib/cloudApi';

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Request failed.';
}

const KIND_LABELS: Record<string, string> = {
  key: 'Key',
  system_fact: 'System',
  manual_fact: 'Manual',
  derived_fact: 'Derived',
  internal_fact: 'Internal',
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-success-bg text-success-fg'
      : status === 'draft'
        ? 'bg-warning-bg text-warning-fg'
        : 'bg-surface-subtle text-fg-subtle';
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function FactCatalogPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orgs, setOrgs] = useState<CloudOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [facts, setFacts] = useState<CloudFact[]>([]);
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; fact: CloudFact } | null
  >(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const loadFacts = useCallback(async (workspaceId: string, spinner = true) => {
    if (!workspaceId) {
      setFacts([]);
      return;
    }
    if (spinner) setRefreshing(true);
    try {
      const result = await listFacts(workspaceId);
      setFacts(result.facts);
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
      await loadFacts(nextId, false);
    },
    [loadFacts],
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

  const handleWorkspaceChange = async (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    await loadFacts(workspaceId);
  };

  const handleSubmit = async (input: FactInput) => {
    if (!selectedWorkspaceId) return;
    try {
      if (dialog?.mode === 'edit') {
        await updateFact(dialog.fact.id, input);
        toast.success('Fact updated.');
      } else {
        await createFact(selectedWorkspaceId, input);
        toast.success('Fact created.');
      }
      setDialog(null);
      await loadFacts(selectedWorkspaceId);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleDeprecate = async (fact: CloudFact) => {
    if (
      !(await confirm({
        title: 'Deprecate fact',
        description: `Deprecate "${fact.name}"? It can no longer be bound to new fields.`,
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await deprecateFact(fact.id);
      toast.success('Fact deprecated.');
      await loadFacts(selectedWorkspaceId);
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
            href={
              selectedWorkspaceId
                ? `/settings/workspace?workspaceId=${selectedWorkspaceId}`
                : '/settings/workspace'
            }
            className="inline-flex h-8 items-center gap-2 rounded border border-line px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
          >
            <Boxes className="h-4 w-4" />
            Workspace settings
          </a>
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
              <Database className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-fg">Fact catalog</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
              Business facts a decision logic can use. Bind logic fields to
              these facts, then resolve them from reference tables.
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
                    void handleWorkspaceChange(event.target.value)
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

        <DataNav active="facts" workspaceId={selectedWorkspaceId} />

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
            <p className="mt-2 text-sm text-fg-subtle">
              Create a workspace before defining facts.
            </p>
          </section>
        ) : (
          <section className="rounded border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-fg-faint" />
                <h2 className="text-sm font-semibold text-fg">
                  {facts.length} fact{facts.length === 1 ? '' : 's'}
                </h2>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-fg-faint" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDialog({ mode: 'create' })}
                className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
              >
                <Plus className="h-4 w-4" />
                New fact
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line-subtle bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Kind</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Aliases</th>
                    <th className="px-4 py-2">Sensitive</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="w-24 px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-sm text-fg-subtle"
                      >
                        No facts yet. Create your first fact to get started.
                      </td>
                    </tr>
                  ) : (
                    facts.map((fact) => (
                      <tr
                        key={fact.id}
                        className="border-b border-line-subtle last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-fg">{fact.name}</div>
                          {fact.description ? (
                            <div className="mt-0.5 max-w-md truncate text-xs text-fg-subtle">
                              {fact.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {KIND_LABELS[fact.kind] ?? fact.kind}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">{fact.type}</td>
                        <td className="px-4 py-3 text-fg-subtle">
                          {fact.aliases.length > 0
                            ? fact.aliases.join(', ')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {fact.sensitive ? (
                            <span className="rounded bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-fg">
                              {fact.loggingPolicy}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={fact.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setDialog({ mode: 'edit', fact })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
                              aria-label={`Edit ${fact.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeprecate(fact)}
                              disabled={fact.status === 'deprecated'}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:border-danger-border hover:bg-danger-bg hover:text-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Deprecate ${fact.name}`}
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

      {dialog ? (
        <FactEditorDialog
          mode={dialog.mode}
          initial={dialog.mode === 'edit' ? dialog.fact : undefined}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
