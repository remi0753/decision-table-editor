import type { FieldDef } from '@leverie/engine';
import { ArrowLeft, Boxes, Link2, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { DataNav } from '@/components/data/DataNav';
import { DataReadinessPanel } from '@/components/data/DataReadinessPanel';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  CloudApiError,
  type CloudFact,
  type CloudLogic,
  type CloudOrg,
  type CloudWorkspace,
  type DataReadinessResult,
  getDataReadiness,
  getFactBindings,
  getMe,
  listFacts,
  listLogics,
  listWorkspaces,
  putFactBindings,
} from '@/lib/cloudApi';

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Request failed.';
}

export function LogicBindingsPage() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<CloudOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [logics, setLogics] = useState<CloudLogic[]>([]);
  const [selectedLogicId, setSelectedLogicId] = useState('');
  const [facts, setFacts] = useState<CloudFact[]>([]);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<DataReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedLogic = useMemo(
    () => logics.find((l) => l.id === selectedLogicId) ?? null,
    [logics, selectedLogicId],
  );
  const fieldDefs = useMemo<FieldDef[]>(
    () => Object.values(selectedLogic?.draftData.fieldDefs ?? {}),
    [selectedLogic],
  );

  const loadReadiness = useCallback(async (logicId: string) => {
    setReadinessLoading(true);
    try {
      const result = await getDataReadiness(logicId);
      setReadiness(result.readiness);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  const loadLogic = useCallback(
    async (logicId: string) => {
      setSelectedLogicId(logicId);
      setReadiness(null);
      if (!logicId) {
        setBindings({});
        return;
      }
      try {
        const { bindings: current } = await getFactBindings(logicId);
        const map: Record<string, string> = {};
        for (const b of current) map[b.fieldId] = b.factId;
        setBindings(map);
        await loadReadiness(logicId);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [loadReadiness],
  );

  const loadWorkspaceData = useCallback(
    async (workspaceId: string) => {
      setSelectedWorkspaceId(workspaceId);
      if (!workspaceId) {
        setLogics([]);
        setFacts([]);
        await loadLogic('');
        return;
      }
      const [logicResult, factResult] = await Promise.all([
        listLogics(workspaceId),
        listFacts(workspaceId),
      ]);
      setLogics(logicResult.logics);
      setFacts(factResult.facts);
      await loadLogic(logicResult.logics[0]?.id ?? '');
    },
    [loadLogic],
  );

  const loadWorkspacesForOrg = useCallback(
    async (orgId: string, preferredWorkspaceId?: string) => {
      const result = await listWorkspaces(orgId);
      setWorkspaces(result.workspaces);
      const nextId =
        result.workspaces.find((w) => w.id === preferredWorkspaceId)?.id ??
        result.workspaces[0]?.id ??
        '';
      await loadWorkspaceData(nextId);
    },
    [loadWorkspaceData],
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

  const handleSave = async () => {
    if (!selectedLogicId) return;
    const list = Object.entries(bindings)
      .filter(([, factId]) => factId)
      .map(([fieldId, factId]) => ({ fieldId, factId }));
    setSaving(true);
    try {
      await putFactBindings(selectedLogicId, list);
      toast.success('Bindings saved.');
      await loadReadiness(selectedLogicId);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const factOptionsFor = (field: FieldDef) =>
    facts.filter((f) => f.status === 'active' && f.type === field.type);

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
              <Link2 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-fg">
              Bindings &amp; readiness
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
              Connect a logic's fields to workspace facts, then check whether
              the data setup is ready to publish.
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
                  onChange={(event) =>
                    void (async () => {
                      setSelectedOrgId(event.target.value);
                      try {
                        await loadWorkspacesForOrg(event.target.value);
                      } catch (error) {
                        toast.error(errorMessage(error));
                      }
                    })()
                  }
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
                    void loadWorkspaceData(event.target.value)
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

        <DataNav active="bindings" workspaceId={selectedWorkspaceId} />

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded border border-line bg-surface">
            <Loader2 className="h-5 w-5 animate-spin text-fg-faint" />
          </div>
        ) : logics.length === 0 ? (
          <section className="rounded border border-line bg-surface p-8 text-center">
            <Boxes className="mx-auto h-8 w-8 text-fg-faint" />
            <h2 className="mt-3 text-base font-semibold text-fg">
              No logics in this workspace
            </h2>
            <p className="mt-2 text-sm text-fg-subtle">
              Create a logic in the editor first, then bind its fields here.
            </p>
          </section>
        ) : (
          <div className="space-y-5">
            <label className="block max-w-md">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Logic
              </span>
              <select
                value={selectedLogicId}
                onChange={(event) => void loadLogic(event.target.value)}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                {logics.map((logic) => (
                  <option key={logic.id} value={logic.id}>
                    {logic.name}
                  </option>
                ))}
              </select>
            </label>

            <section className="rounded border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-fg-faint" />
                  <h2 className="text-sm font-semibold text-fg">
                    Field bindings
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || !selectedLogicId}
                  className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save bindings
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line-subtle bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                      <th className="px-4 py-2">Field</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Bound fact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldDefs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-sm text-fg-subtle"
                        >
                          This logic has no fields yet.
                        </td>
                      </tr>
                    ) : (
                      fieldDefs.map((field) => {
                        const options = factOptionsFor(field);
                        return (
                          <tr
                            key={field.id}
                            className="border-b border-line-subtle last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-fg">
                              {field.name}
                            </td>
                            <td className="px-4 py-3 text-fg-muted">
                              {field.type}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={bindings[field.id] ?? ''}
                                onChange={(event) =>
                                  setBindings((current) => ({
                                    ...current,
                                    [field.id]: event.target.value,
                                  }))
                                }
                                className="h-9 w-full max-w-sm rounded border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                              >
                                <option value="">— not bound —</option>
                                {options.map((fact) => (
                                  <option key={fact.id} value={fact.id}>
                                    {fact.name} ({fact.kind})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-fg">
                Publish readiness
              </h2>
              <DataReadinessPanel
                readiness={readiness}
                loading={readinessLoading}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
