import {
  ArrowLeft,
  Ban,
  Boxes,
  Building2,
  Check,
  Clipboard,
  Copy,
  KeyRound,
  Loader2,
  Save,
  Shield,
  SlidersHorizontal,
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
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useConfirm } from '@/hooks/useConfirm';
import {
  CloudApiError,
  type CloudApiKey,
  type CloudApiKeyRole,
  type CloudApiKeyScopeMode,
  type CloudLogic,
  type CloudOrg,
  type CloudRole,
  type CloudWorkspace,
  createApiKey,
  getMe,
  listApiKeys,
  listLogics,
  listWorkspaces,
  revokeApiKey,
  updateWorkspace,
} from '@/lib/cloudApi';

type ManageableOrg = {
  org: CloudOrg;
  role: Extract<CloudRole, 'owner' | 'admin'>;
};

const apiKeyRoles: CloudApiKeyRole[] = ['editor', 'viewer', 'runner'];

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Request failed.';
}

function roleLabel(role: CloudRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function apiKeyStatus(apiKey: CloudApiKey) {
  if (apiKey.revokedAt) return 'Revoked';
  if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now()) {
    return 'Expired';
  }
  return 'Active';
}

function formatRelativeUse(value?: string | null) {
  if (!value) return 'Never used';
  return `Last used ${formatDate(value)}`;
}

type WorkspaceTab = 'general' | 'apiKeys';

export function WorkspaceSettingsPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('general');
  const [orgs, setOrgs] = useState<ManageableOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [apiKeys, setApiKeys] = useState<CloudApiKey[]>([]);
  const [workspaceLogics, setWorkspaceLogics] = useState<CloudLogic[]>([]);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyRole, setApiKeyRole] = useState<CloudApiKeyRole>('viewer');
  const [apiKeyScopeMode, setApiKeyScopeMode] =
    useState<CloudApiKeyScopeMode>('all');
  const [selectedLogicIds, setSelectedLogicIds] = useState<string[]>([]);
  const [issuingApiKey, setIssuingApiKey] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] = useState<{
    name: string;
    secret: string;
  } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const selectedOrg = useMemo(
    () => orgs.find((entry) => entry.org.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );
  const selectedWorkspace = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      null,
    [workspaces, selectedWorkspaceId],
  );
  const activeApiKeys = apiKeys.filter(
    (apiKey) => apiKeyStatus(apiKey) === 'Active',
  );

  const loadApiKeyData = useCallback(
    async (workspaceId: string, showSpinner = true) => {
      if (!workspaceId) {
        setApiKeys([]);
        setWorkspaceLogics([]);
        return;
      }
      if (showSpinner) setRefreshing(true);
      try {
        const [apiKeyResult, logicResult] = await Promise.all([
          listApiKeys(workspaceId),
          listLogics(workspaceId),
        ]);
        setApiKeys(apiKeyResult.apiKeys);
        setWorkspaceLogics(logicResult.logics);
        setSelectedLogicIds((current) =>
          current.filter((logicId) =>
            logicResult.logics.some((logic) => logic.id === logicId),
          ),
        );
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        if (showSpinner) setRefreshing(false);
      }
    },
    [],
  );

  const loadOrgWorkspaces = useCallback(
    async (
      orgId: string,
      showSpinner = true,
      preferredWorkspaceId?: string,
    ) => {
      if (showSpinner) setRefreshing(true);
      try {
        const workspaceResult = await listWorkspaces(orgId);
        setWorkspaces(workspaceResult.workspaces);
        const nextWorkspaceId =
          workspaceResult.workspaces.find(
            (workspace) => workspace.id === preferredWorkspaceId,
          )?.id ??
          workspaceResult.workspaces[0]?.id ??
          '';
        setSelectedWorkspaceId(nextWorkspaceId);
        setSelectedLogicIds([]);
        await loadApiKeyData(nextWorkspaceId, false);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        if (showSpinner) setRefreshing(false);
      }
    },
    [loadApiKeyData],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        const manageable = me.orgs
          .filter(
            (
              membership,
            ): membership is (typeof me.orgs)[number] & {
              role: 'owner' | 'admin';
            } => membership.role === 'owner' || membership.role === 'admin',
          )
          .map((membership) => ({
            org: membership.org,
            role: membership.role,
          }));
        setOrgs(manageable);
        const firstOrgId = manageable[0]?.org.id ?? '';
        setSelectedOrgId(firstOrgId);
        const preferredWorkspaceId =
          new URLSearchParams(window.location.search).get('workspaceId') ??
          undefined;
        if (firstOrgId) {
          await loadOrgWorkspaces(firstOrgId, false, preferredWorkspaceId);
        }
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
  }, [loadOrgWorkspaces]);

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedWorkspaceId('');
    setApiKeys([]);
    setWorkspaceLogics([]);
    setSelectedLogicIds([]);
    await loadOrgWorkspaces(orgId);
  };

  const handleWorkspaceChange = async (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSelectedLogicIds([]);
    await loadApiKeyData(workspaceId);
  };

  const handleLogicToggle = (logicId: string, checked: boolean) => {
    setSelectedLogicIds((current) =>
      checked
        ? [...current, logicId]
        : current.filter((candidate) => candidate !== logicId),
    );
  };

  const handleIssueApiKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedWorkspace || !apiKeyName.trim()) return;
    if (apiKeyScopeMode === 'allowlist' && selectedLogicIds.length === 0) {
      toast.error('Choose at least one logic for an allow-list key.');
      return;
    }

    setIssuingApiKey(true);
    try {
      const result = await createApiKey({
        workspaceId: selectedWorkspace.id,
        name: apiKeyName.trim(),
        role: apiKeyRole,
        scopeMode: apiKeyScopeMode,
        logicIds: apiKeyScopeMode === 'allowlist' ? selectedLogicIds : [],
      });
      setOneTimeSecret({ name: result.apiKey.name, secret: result.secret });
      setCopiedSecret(false);
      setApiKeyName('');
      setApiKeyRole('viewer');
      setApiKeyScopeMode('all');
      setSelectedLogicIds([]);
      toast.success('API key issued.');
      await loadApiKeyData(selectedWorkspace.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIssuingApiKey(false);
    }
  };

  const handleCopySecret = async () => {
    if (!oneTimeSecret) return;
    try {
      await navigator.clipboard.writeText(oneTimeSecret.secret);
      setCopiedSecret(true);
      toast.success('API key copied.');
    } catch {
      toast.error('Could not copy API key.');
    }
  };

  const handleRevokeApiKey = async (key: CloudApiKey) => {
    if (!selectedWorkspace) return;
    if (
      !(await confirm({
        title: 'Revoke API key',
        description: `Revoke "${key.name}"? This cannot be undone.`,
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await revokeApiKey(key.id);
      toast.success('API key revoked.');
      await loadApiKeyData(selectedWorkspace.id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleWorkspaceDetailsSave = async (values: {
    name: string;
    description: string;
  }) => {
    if (!selectedOrg || !selectedWorkspace) return;
    await updateWorkspace(selectedWorkspace.id, {
      name: values.name.trim(),
      description: values.description.trim() || null,
    });
    toast.success('Workspace updated.');
    await loadOrgWorkspaces(selectedOrg.org.id, true, selectedWorkspace.id);
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
              selectedOrgId
                ? `/settings/org?orgId=${selectedOrgId}`
                : '/settings/org'
            }
            className="inline-flex h-8 items-center gap-2 rounded border border-line px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
          >
            <Building2 className="h-4 w-4" />
            Organization settings
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
              <Boxes className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-fg">
              Workspace settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
              Manage workspace details, API keys, and logic access.
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
                  {orgs.map((entry) => (
                    <option key={entry.org.id} value={entry.org.id}>
                      {entry.org.name} ({roleLabel(entry.role)})
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

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded border border-line bg-surface">
            <Loader2 className="h-5 w-5 animate-spin text-fg-faint" />
          </div>
        ) : orgs.length === 0 ? (
          <section className="rounded border border-line bg-surface p-8 text-center">
            <Shield className="mx-auto h-8 w-8 text-fg-faint" />
            <h2 className="mt-3 text-base font-semibold text-fg">
              Owner or admin access required
            </h2>
            <p className="mt-2 text-sm text-fg-subtle">
              Ask an organization owner or admin to manage workspace API keys.
            </p>
          </section>
        ) : workspaces.length === 0 ? (
          <section className="rounded border border-line bg-surface p-8 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-fg-faint" />
            <h2 className="mt-3 text-base font-semibold text-fg">
              No workspaces yet
            </h2>
            <p className="mt-2 text-sm text-fg-subtle">
              Create a workspace before issuing API keys.
            </p>
          </section>
        ) : selectedOrg && selectedWorkspace ? (
          <>
            <div className="mb-5 inline-flex rounded border border-line bg-surface p-1">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium ${
                  activeTab === 'general'
                    ? 'bg-brand text-white'
                    : 'text-fg-muted hover:bg-surface-muted'
                }`}
              >
                <Boxes className="h-4 w-4" />
                General
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('apiKeys')}
                className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium ${
                  activeTab === 'apiKeys'
                    ? 'bg-brand text-white'
                    : 'text-fg-muted hover:bg-surface-muted'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                API keys
              </button>
            </div>

            {activeTab === 'general' ? (
              <WorkspaceDetailsCard
                key={selectedWorkspace.id}
                workspace={selectedWorkspace}
                onSave={handleWorkspaceDetailsSave}
              />
            ) : (
              <section className="rounded border border-line bg-surface">
                <div className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-fg-faint" />
                    <div>
                      <h2 className="text-sm font-semibold text-fg">
                        API keys
                      </h2>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        Credentials for hosted API and MCP access in{' '}
                        {selectedWorkspace.name}.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-fg-faint" />
                    ) : (
                      <span className="rounded bg-success-bg px-2 py-0.5 text-xs font-medium text-success-fg">
                        {activeApiKeys.length} active
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-line-subtle bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                          <th className="px-4 py-2">Key</th>
                          <th className="px-4 py-2">Role</th>
                          <th className="px-4 py-2">Scope</th>
                          <th className="px-4 py-2">Usage</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="w-16 px-4 py-2 text-right">Revoke</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-8 text-center text-sm text-fg-subtle"
                            >
                              No API keys for this workspace yet.
                            </td>
                          </tr>
                        ) : (
                          apiKeys.map((key) => {
                            const status = apiKeyStatus(key);
                            const scopedNames =
                              key.scopeMode === 'all'
                                ? 'All logics'
                                : key.logicIds
                                    .map(
                                      (logicId) =>
                                        workspaceLogics.find(
                                          (logic) => logic.id === logicId,
                                        )?.name ?? 'Unknown logic',
                                    )
                                    .join(', ');
                            return (
                              <tr
                                key={key.id}
                                className="border-b border-line-subtle last:border-0"
                              >
                                <td className="px-4 py-3">
                                  <div className="font-medium text-fg">
                                    {key.name}
                                  </div>
                                  <div className="mt-1 font-mono text-xs text-fg-subtle">
                                    {key.keyPrefix}...
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="rounded bg-surface-subtle px-2 py-1 text-xs font-medium text-fg-secondary">
                                    {roleLabel(key.role)}
                                  </span>
                                </td>
                                <td className="max-w-64 px-4 py-3 text-fg-muted">
                                  <div className="truncate" title={scopedNames}>
                                    {scopedNames || 'No logics selected'}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-fg-subtle">
                                  {formatRelativeUse(key.lastUsedAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`rounded px-2 py-1 text-xs font-medium ${
                                      status === 'Active'
                                        ? 'bg-success-bg text-success-fg'
                                        : 'bg-surface-subtle text-fg-subtle'
                                    }`}
                                  >
                                    {status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => void handleRevokeApiKey(key)}
                                    disabled={status !== 'Active'}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:border-danger-border hover:bg-danger-bg hover:text-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={`Revoke API key ${key.name}`}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <form
                    onSubmit={handleIssueApiKey}
                    className="border-t border-line-subtle p-4 lg:border-l lg:border-t-0"
                  >
                    <div className="mb-4 flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-fg-faint" />
                      <h3 className="text-sm font-semibold text-fg">
                        Issue key
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-fg-muted">
                          Name
                        </span>
                        <input
                          value={apiKeyName}
                          onChange={(event) =>
                            setApiKeyName(event.target.value)
                          }
                          placeholder="Production MCP"
                          required
                          className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-fg-muted">
                          Role
                        </span>
                        <select
                          value={apiKeyRole}
                          onChange={(event) =>
                            setApiKeyRole(event.target.value as CloudApiKeyRole)
                          }
                          className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                        >
                          {apiKeyRoles.map((candidateRole) => (
                            <option key={candidateRole} value={candidateRole}>
                              {roleLabel(candidateRole)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div>
                        <span className="mb-1 block text-xs font-medium text-fg-muted">
                          Scope
                        </span>
                        <div className="grid grid-cols-2 overflow-hidden rounded border border-line">
                          {(['all', 'allowlist'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setApiKeyScopeMode(mode)}
                              className={`h-9 text-xs font-medium ${
                                apiKeyScopeMode === mode
                                  ? 'bg-brand text-white'
                                  : 'bg-surface text-fg-muted hover:bg-surface-muted'
                              }`}
                            >
                              {mode === 'all' ? 'All logics' : 'Pick logics'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {apiKeyScopeMode === 'allowlist' ? (
                        <div>
                          <span className="mb-1 block text-xs font-medium text-fg-muted">
                            Allowed logics
                          </span>
                          <div className="max-h-40 overflow-auto rounded border border-line">
                            {workspaceLogics.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-fg-subtle">
                                Publish or create a logic in this workspace
                                before using an allow-list.
                              </div>
                            ) : (
                              workspaceLogics.map((logic) => (
                                <label
                                  key={logic.id}
                                  className="flex items-start gap-2 border-b border-line-subtle px-3 py-2 text-sm last:border-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedLogicIds.includes(
                                      logic.id,
                                    )}
                                    onChange={(event) =>
                                      handleLogicToggle(
                                        logic.id,
                                        event.target.checked,
                                      )
                                    }
                                    className="mt-1"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium text-fg-secondary">
                                      {logic.name}
                                    </span>
                                    <span className="block truncate text-xs text-fg-subtle">
                                      {logic.slug}
                                    </span>
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        disabled={issuingApiKey || !selectedWorkspace}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-ink px-3 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
                      >
                        {issuingApiKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="h-4 w-4" />
                        )}
                        Issue API key
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>

      {oneTimeSecret ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-key-secret-title"
            className="w-full max-w-lg rounded border border-line bg-surface shadow-xl"
          >
            <div className="border-b border-line-subtle px-5 py-4">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded border border-warning-border bg-warning-bg text-warning-fg">
                <Clipboard className="h-5 w-5" />
              </div>
              <h2
                id="api-key-secret-title"
                className="text-lg font-semibold text-fg"
              >
                Save this API key now
              </h2>
              <p className="mt-2 text-sm leading-6 text-fg-muted">
                This is the only time the full key for {oneTimeSecret.name} will
                be shown.
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="rounded border border-line bg-surface-muted p-3">
                <div className="break-all font-mono text-sm leading-6 text-fg">
                  {oneTimeSecret.secret}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOneTimeSecret(null)}
                  className="inline-flex h-10 items-center justify-center rounded border border-line px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopySecret()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
                >
                  {copiedSecret ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedSecret ? 'Copied' : 'Copy key'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  );
}

function WorkspaceDetailsCard({
  workspace,
  onSave,
}: {
  workspace: CloudWorkspace;
  onSave: (values: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? '');
  const [saving, setSaving] = useState(false);

  const dirty =
    name.trim() !== workspace.name ||
    description.trim() !== (workspace.description ?? '');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !dirty) return;
    setSaving(true);
    try {
      await onSave({ name, description });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
        <Boxes className="h-4 w-4 text-fg-faint" />
        <div>
          <h2 className="text-sm font-semibold text-fg">Workspace details</h2>
          <p className="mt-0.5 text-xs text-fg-subtle">
            Name and description for this workspace.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Slug
            </span>
            <input
              value={workspace.slug}
              disabled
              className="h-10 w-full rounded border border-line bg-surface-muted px-3 font-mono text-sm text-fg-subtle"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-muted">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What is this workspace for?"
            className="w-full rounded border border-line px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !dirty || !name.trim()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </button>
        </div>
      </form>
    </section>
  );
}
