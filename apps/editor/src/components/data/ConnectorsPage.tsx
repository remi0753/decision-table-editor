import {
  ArrowLeft,
  Ban,
  Boxes,
  Database,
  Globe,
  Loader2,
  Plus,
  Save,
  Workflow,
  X,
} from 'lucide-react';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { DataNav } from '@/components/data/DataNav';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useConfirm } from '@/hooks/useConfirm';
import {
  CloudApiError,
  type CloudDataSource,
  type CloudFact,
  type CloudOrg,
  type CloudResolver,
  type CloudWorkspace,
  createDataSource,
  createResolver,
  type DataSourceInput,
  disableDataSource,
  getMe,
  listDataSources,
  listFacts,
  listResolvers,
  listWorkspaces,
  type ResolverInput,
  type ResolverOperationRef,
} from '@/lib/cloudApi';

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Request failed.';
}

const LIVE_KINDS = new Set(['database', 'openapi_http']);

// Live connectors (database / HTTP). Unlike reference tables these never copy
// data into LEVERIE — a resolver reads one record at decision time, so personal
// data stays in the source system.
export function ConnectorsPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orgs, setOrgs] = useState<CloudOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [sources, setSources] = useState<CloudDataSource[]>([]);
  const [resolvers, setResolvers] = useState<CloudResolver[]>([]);
  const [facts, setFacts] = useState<CloudFact[]>([]);
  const [showConnector, setShowConnector] = useState(false);
  const [resolverTarget, setResolverTarget] = useState<CloudDataSource | null>(
    null,
  );

  const liveSources = useMemo(
    () => sources.filter((s) => LIVE_KINDS.has(s.kind)),
    [sources],
  );
  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const loadData = useCallback(async (workspaceId: string, spinner = true) => {
    if (!workspaceId) {
      setSources([]);
      setResolvers([]);
      setFacts([]);
      return;
    }
    if (spinner) setRefreshing(true);
    try {
      const [srcResult, resolverResult, factResult] = await Promise.all([
        listDataSources(workspaceId),
        listResolvers(workspaceId),
        listFacts(workspaceId),
      ]);
      setSources(srcResult.dataSources);
      setResolvers(resolverResult.resolvers);
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

  const handleDisable = async (source: CloudDataSource) => {
    if (
      !(await confirm({
        title: 'Disable connector',
        description: `Disable "${source.name}"? Resolvers using it will stop resolving.`,
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await disableDataSource(source.id);
      toast.success('Connector disabled.');
      await loadData(selectedWorkspaceId);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const resolverCountBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of resolvers) {
      if (r.status !== 'active') continue;
      counts.set(r.dataSourceId, (counts.get(r.dataSourceId) ?? 0) + 1);
    }
    return counts;
  }, [resolvers]);

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
              <Database className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-fg">Live connectors</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
              Connect a read-only database or HTTP/OpenAPI API. Data is read one
              record at a time during a decision and never copied into LEVERIE —
              the right choice for large datasets and personal data.
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
                      setRefreshing(true);
                      try {
                        await loadWorkspacesForOrg(event.target.value);
                      } finally {
                        setRefreshing(false);
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

        <DataNav active="connectors" workspaceId={selectedWorkspaceId} />

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
                <Database className="h-4 w-4 text-fg-faint" />
                <h2 className="text-sm font-semibold text-fg">
                  {liveSources.length} connector
                  {liveSources.length === 1 ? '' : 's'}
                </h2>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-fg-faint" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setShowConnector(true)}
                className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
              >
                <Plus className="h-4 w-4" />
                New connector
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line-subtle bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Kind</th>
                    <th className="px-4 py-2">Auth</th>
                    <th className="px-4 py-2">Resolvers</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="w-44 px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {liveSources.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-fg-subtle"
                      >
                        No live connectors yet. Add a database or HTTP connector
                        to resolve facts without copying data.
                      </td>
                    </tr>
                  ) : (
                    liveSources.map((source) => (
                      <tr
                        key={source.id}
                        className="border-b border-line-subtle last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-fg">
                          {source.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-fg-muted">
                            {source.kind === 'database' ? (
                              <Database className="h-3.5 w-3.5" />
                            ) : (
                              <Globe className="h-3.5 w-3.5" />
                            )}
                            {source.kind === 'database' ? 'Database' : 'HTTP'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {source.authType === 'none'
                            ? source.kind === 'database'
                              ? 'URL secret'
                              : 'none'
                            : source.authType}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {resolverCountBySource.get(source.id) ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              source.status === 'active'
                                ? 'bg-success-bg text-success-fg'
                                : 'bg-surface-subtle text-fg-subtle'
                            }`}
                          >
                            {source.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setResolverTarget(source)}
                              disabled={source.status !== 'active'}
                              className="inline-flex h-8 items-center gap-1.5 rounded border border-line px-2 text-xs text-fg-subtle hover:bg-surface-muted disabled:opacity-40"
                            >
                              <Workflow className="h-3.5 w-3.5" />
                              Resolver
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDisable(source)}
                              disabled={source.status !== 'active'}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:border-danger-border hover:bg-danger-bg hover:text-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Disable ${source.name}`}
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

      {showConnector && selectedWorkspaceId ? (
        <ConnectorDialog
          workspaceId={selectedWorkspaceId}
          onClose={() => setShowConnector(false)}
          onCreated={() => {
            setShowConnector(false);
            void loadData(selectedWorkspaceId);
          }}
        />
      ) : null}

      {resolverTarget && selectedWorkspaceId ? (
        <LiveResolverDialog
          workspaceId={selectedWorkspaceId}
          source={resolverTarget}
          facts={facts}
          onClose={() => setResolverTarget(null)}
          onCreated={() => {
            setResolverTarget(null);
            void loadData(selectedWorkspaceId);
          }}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}

function ConnectorDialog({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'database' | 'openapi_http'>('database');
  const [dbUrl, setDbUrl] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [authType, setAuthType] = useState('bearer');
  const [token, setToken] = useState('');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');

    const input: DataSourceInput = { name: name.trim(), kind };
    if (kind === 'database') {
      if (!dbUrl.trim()) return toast.error('A connection URL is required.');
      input.auth = { type: 'database_url', value: { url: dbUrl.trim() } };
    } else {
      const domains = allowedDomains
        .split(/[\n,]/)
        .map((d) => d.trim())
        .filter(Boolean);
      if (domains.length === 0) {
        return toast.error('At least one allowed domain is required.');
      }
      input.allowedDomains = domains;
      if (authType !== 'none') {
        if (!token.trim())
          return toast.error('A credential value is required.');
        input.auth =
          authType === 'api_key'
            ? {
                type: 'api_key',
                value: { key: token.trim(), header: apiKeyHeader.trim() },
              }
            : { type: authType, value: { token: token.trim() } };
      }
    }

    setSaving(true);
    try {
      await createDataSource(workspaceId, input);
      toast.success('Connector created.');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Create failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell title="New connector" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Shopify Orders"
            className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
          />
        </Field>
        <Field label="Kind">
          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as 'database' | 'openapi_http')
            }
            className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
          >
            <option value="database">Database (read-only SQL)</option>
            <option value="openapi_http">HTTP / OpenAPI (GET)</option>
          </select>
        </Field>

        {kind === 'database' ? (
          <Field label="Connection URL (stored encrypted, server-side only)">
            <input
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              placeholder="postgres://readonly:•••@host:5432/db"
              className="h-10 w-full rounded border border-line px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </Field>
        ) : (
          <>
            <Field label="Allowed domains (one per line — requests are denied otherwise)">
              <textarea
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                rows={2}
                placeholder={'api.shopify.com'}
                className="w-full rounded border border-line px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
            </Field>
            <Field label="Authentication">
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value)}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                <option value="bearer">Bearer token</option>
                <option value="api_key">API key header</option>
                <option value="basic">
                  Basic (token = user:pass via base64)
                </option>
                <option value="none">None</option>
              </select>
            </Field>
            {authType !== 'none' ? (
              <>
                {authType === 'api_key' ? (
                  <Field label="Header name">
                    <input
                      value={apiKeyHeader}
                      onChange={(e) => setApiKeyHeader(e.target.value)}
                      className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    />
                  </Field>
                ) : null}
                <Field label="Credential value (stored encrypted)">
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    type="password"
                    className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                  />
                </Field>
              </>
            ) : null}
          </>
        )}

        <DialogActions
          onClose={onClose}
          saving={saving}
          submitLabel="Create connector"
        />
      </form>
    </DialogShell>
  );
}

function LiveResolverDialog({
  workspaceId,
  source,
  facts,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  source: CloudDataSource;
  facts: CloudFact[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const activeFacts = useMemo(
    () => facts.filter((f) => f.status === 'active'),
    [facts],
  );
  const keyFacts = activeFacts.filter((f) => f.kind === 'key');
  const isDb = source.kind === 'database';

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [urlTemplate, setUrlTemplate] = useState('');
  const [recordPath, setRecordPath] = useState('');
  const [params, setParams] = useState<{ name: string; factId: string }[]>([
    { name: '', factId: keyFacts[0]?.id ?? '' },
  ]);
  const [outputs, setOutputs] = useState<
    { columnName: string; factId: string }[]
  >([{ columnName: '', factId: '' }]);
  const [fallbackPolicy, setFallbackPolicy] = useState('ask_operator');
  const [saving, setSaving] = useState(false);

  const setParam = (
    i: number,
    patch: Partial<{ name: string; factId: string }>,
  ) =>
    setParams((cur) =>
      cur.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  const setOutput = (
    i: number,
    patch: Partial<{ columnName: string; factId: string }>,
  ) =>
    setOutputs((cur) =>
      cur.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    const cleanParams = params.filter((p) => p.name.trim() && p.factId);
    if (cleanParams.length === 0) {
      return toast.error('Add at least one parameter bound to a key fact.');
    }
    if (!cleanParams.some((p) => keyFacts.some((f) => f.id === p.factId))) {
      return toast.error('At least one parameter must use a key fact.');
    }
    const cleanOutputs = outputs.filter((o) => o.columnName.trim() && o.factId);
    if (cleanOutputs.length === 0) {
      return toast.error('Map at least one output field to a fact.');
    }

    let operationRef: ResolverOperationRef;
    if (isDb) {
      if (!query.trim()) return toast.error('A SQL query is required.');
      operationRef = {
        kind: 'db_query',
        query: query.trim(),
        params: cleanParams.map((p) => ({
          name: p.name.trim(),
          factId: p.factId,
        })),
      };
    } else {
      if (!/^https?:\/\//i.test(urlTemplate.trim())) {
        return toast.error('A http(s) URL template is required.');
      }
      operationRef = {
        kind: 'http_operation',
        method: 'GET',
        urlTemplate: urlTemplate.trim(),
        params: cleanParams.map((p) => ({
          name: p.name.trim(),
          factId: p.factId,
        })),
        recordPath: recordPath.trim() || undefined,
      };
    }

    const input: ResolverInput = {
      name: name.trim(),
      dataSourceId: source.id,
      inputFactIds: Array.from(new Set(cleanParams.map((p) => p.factId))),
      operationRef,
      outputMappings: cleanOutputs.map((o) => ({
        columnName: o.columnName.trim(),
        factId: o.factId,
      })),
      fallbackPolicy,
    };

    setSaving(true);
    try {
      await createResolver(workspaceId, input);
      toast.success('Resolver created.');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Create failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell title={`New resolver — ${source.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Resolve order facts"
            className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
          />
        </Field>

        {isDb ? (
          <Field label="Read-only SQL (use :name placeholders bound below)">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              placeholder="SELECT purchase_date, total, tier FROM orders WHERE order_id = :order_id"
              className="w-full rounded border border-line px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </Field>
        ) : (
          <>
            <Field label="URL template (use {name} placeholders bound below)">
              <input
                value={urlTemplate}
                onChange={(e) => setUrlTemplate(e.target.value)}
                placeholder="https://api.shopify.com/orders/{order_id}.json"
                className="h-10 w-full rounded border border-line px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
            </Field>
            <Field label="Record path (optional, e.g. data.order)">
              <input
                value={recordPath}
                onChange={(e) => setRecordPath(e.target.value)}
                placeholder="order"
                className="h-10 w-full rounded border border-line px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
            </Field>
          </>
        )}

        <RepeatableRows
          label={
            isDb
              ? 'Query parameters → input facts (the operator provides these keys)'
              : 'URL parameters → input facts (the operator provides these keys)'
          }
          rows={params}
          onAdd={() => setParams((c) => [...c, { name: '', factId: '' }])}
          onRemove={(i) => setParams((c) => c.filter((_, idx) => idx !== i))}
          render={(row, i) => (
            <>
              <input
                value={row.name}
                onChange={(e) => setParam(i, { name: e.target.value })}
                placeholder={
                  isDb ? ':order_id → order_id' : '{order_id} → order_id'
                }
                className="h-9 w-40 rounded border border-line px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
              <select
                value={row.factId}
                onChange={(e) => setParam(i, { factId: e.target.value })}
                className="h-9 w-full rounded border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                <option value="">— choose key fact —</option>
                {activeFacts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.kind})
                  </option>
                ))}
              </select>
            </>
          )}
        />

        <RepeatableRows
          label={
            isDb
              ? 'Result columns → facts (resolved from the returned row)'
              : 'Response fields → facts (dot paths allowed, resolved from the record)'
          }
          rows={outputs}
          onAdd={() =>
            setOutputs((c) => [...c, { columnName: '', factId: '' }])
          }
          onRemove={(i) => setOutputs((c) => c.filter((_, idx) => idx !== i))}
          render={(row, i) => (
            <>
              <input
                value={row.columnName}
                onChange={(e) => setOutput(i, { columnName: e.target.value })}
                placeholder={isDb ? 'purchase_date' : 'created_at'}
                className="h-9 w-40 rounded border border-line px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
              <select
                value={row.factId}
                onChange={(e) => setOutput(i, { factId: e.target.value })}
                className="h-9 w-full rounded border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                <option value="">— choose fact —</option>
                {activeFacts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </select>
            </>
          )}
        />

        <Field label="If a fact can't be resolved">
          <select
            value={fallbackPolicy}
            onChange={(e) => setFallbackPolicy(e.target.value)}
            className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
          >
            {['ask_operator', 'mark_unavailable', 'block'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <DialogActions
          onClose={onClose}
          saving={saving}
          submitLabel="Create resolver"
        />
      </form>
    </DialogShell>
  );
}

// ── small shared dialog primitives ────────────────────────────────────────────

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-medium text-fg-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function DialogActions({
  onClose,
  saving,
  submitLabel,
}: {
  onClose: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-10 items-center justify-center rounded border border-line px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-10 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {submitLabel}
      </button>
    </div>
  );
}

function RepeatableRows<T>({
  label,
  rows,
  onAdd,
  onRemove,
  render,
}: {
  label: string;
  rows: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  render: (row: T, index: number) => React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-xs font-medium text-fg-muted">
        {label}
      </span>
      <div className="space-y-2">
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: editable row list
          <div key={i} className="flex items-center gap-2">
            {render(row, i)}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
              aria-label="Remove row"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded border border-line px-2 text-xs font-medium text-fg-secondary hover:bg-surface-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </button>
    </div>
  );
}
