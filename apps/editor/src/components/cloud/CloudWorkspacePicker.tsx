import { Cloud, Plus } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  clearMigrationDraft,
  loadMigrationDraft,
} from '@/hooks/useLocalStorage';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { createInitialLogic, useLogicStore } from '@/store/logicStore';

const NEW_LOGIC = 'new';
const LOGIC_ID_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function logicIdFromName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63)
      .replace(/-+$/g, '') || 'logic'
  );
}

export function CloudWorkspacePicker() {
  const logic = useLogicStore((s) => s.logic);
  const importLogic = useLogicStore((s) => s.importLogic);
  const mode = useCloudStore((s) => s.mode);
  const choices = useCloudStore((s) => s.choices);
  const saveState = useCloudStore((s) => s.saveState);
  const selectCloudTarget = useCloudStore((s) => s.selectCloudTarget);
  const [orgId, setOrgId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [logicId, setLogicId] = useState(NEW_LOGIC);
  const [logicName, setLogicName] = useState(logic.name);
  const [logicStableId, setLogicStableId] = useState(
    logicIdFromName(logic.name),
  );
  const [logicDescription, setLogicDescription] = useState(
    logic.description ?? '',
  );
  const [logicIdEdited, setLogicIdEdited] = useState(false);
  // A local draft preserved when the user left local mode to authenticate. When
  // present, the new-logic form lets the user choose to seed the cloud logic
  // from it instead of starting blank.
  const stashedDraft = useMemo(() => loadMigrationDraft(), []);
  const [seedFromLocal, setSeedFromLocal] = useState(
    () => stashedDraft !== null,
  );
  const seedLogic = useMemo(
    () => (seedFromLocal && stashedDraft ? stashedDraft : createInitialLogic()),
    [seedFromLocal, stashedDraft],
  );
  const t = useT();

  const workspaces = useMemo(
    () => (orgId && choices ? (choices.workspacesByOrgId[orgId] ?? []) : []),
    [choices, orgId],
  );
  const logics = useMemo(
    () =>
      workspaceId && choices
        ? (choices.logicsByWorkspaceId[workspaceId] ?? [])
        : [],
    [choices, workspaceId],
  );
  const selectedRole = orgId && choices ? choices.roleByOrgId[orgId] : null;
  const canCreateLogic =
    selectedRole === 'owner' ||
    selectedRole === 'admin' ||
    selectedRole === 'editor';
  const creatingNewLogic = logicId === NEW_LOGIC;
  const trimmedLogicName = logicName.trim();
  const trimmedLogicStableId = logicStableId.trim();
  const logicStableIdValid = LOGIC_ID_PATTERN.test(trimmedLogicStableId);
  const logicFormValid =
    !creatingNewLogic || (trimmedLogicName.length > 0 && logicStableIdValid);

  useEffect(() => {
    if (!choices || orgId) return;
    setOrgId(choices.orgs[0]?.id ?? '');
  }, [choices, orgId]);

  useEffect(() => {
    setWorkspaceId(workspaces[0]?.id ?? '');
  }, [workspaces]);

  useEffect(() => {
    setLogicId(
      choices?.preferNewLogic && canCreateLogic
        ? NEW_LOGIC
        : (logics[0]?.id ?? (canCreateLogic ? NEW_LOGIC : '')),
    );
  }, [canCreateLogic, choices?.preferNewLogic, logics]);

  useEffect(() => {
    setLogicName(seedLogic.name);
    setLogicDescription(seedLogic.description ?? '');
    if (!logicIdEdited) setLogicStableId(logicIdFromName(seedLogic.name));
  }, [seedLogic, logicIdEdited]);

  if (mode !== 'selecting' || !choices) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!orgId) return;
    // When creating a new logic, seed it from the chosen source (the preserved
    // local draft or a blank logic); existing-logic selections ignore this.
    await selectCloudTarget(
      {
        orgId,
        workspaceId: workspaceId || undefined,
        logicId,
        newLogic: creatingNewLogic
          ? {
              name: trimmedLogicName,
              slug: trimmedLogicStableId,
              description: logicDescription.trim() || undefined,
            }
          : undefined,
      },
      creatingNewLogic ? seedLogic : logic,
      importLogic,
    );
    if (creatingNewLogic && useCloudStore.getState().mode === 'cloud') {
      clearMigrationDraft();
    }
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
      } else {
        window.location.assign('/access');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-surface/85 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded border border-line bg-surface p-5 shadow-xl"
        >
          <div className="mb-5 flex items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-success-border bg-success-bg text-success-fg">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">
                Choose cloud workspace
              </h2>
              <p className="mt-1 text-sm leading-6 text-fg-subtle">
                Select where this editor session should load and save.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Organization
              </span>
              <select
                value={orgId}
                onChange={(event) => setOrgId(event.target.value)}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                {choices.orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Workspace
              </span>
              <select
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                {workspaces.length === 0 ? (
                  <option value="">Create Default workspace</option>
                ) : (
                  workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Logic
              </span>
              <select
                value={logicId}
                onChange={(event) => setLogicId(event.target.value)}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                {logics.map((cloudLogic) => (
                  <option key={cloudLogic.id} value={cloudLogic.id}>
                    {cloudLogic.name}
                  </option>
                ))}
                {canCreateLogic ? (
                  <option value={NEW_LOGIC}>Create a new logic</option>
                ) : null}
                {!canCreateLogic && logics.length === 0 ? (
                  <option value="">No shared runners available</option>
                ) : null}
              </select>
            </label>

            {creatingNewLogic && canCreateLogic ? (
              <div className="space-y-3 rounded border border-line bg-surface-muted p-3">
                {stashedDraft ? (
                  <div>
                    <span className="mb-1 block text-xs font-medium text-fg-muted">
                      {t.newLogicSourceLabel}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSeedFromLocal(true)}
                        className={`h-9 rounded border px-2 text-xs font-medium transition-colors ${
                          seedFromLocal
                            ? 'border-brand-border-strong bg-brand-subtle text-brand-fg-strong'
                            : 'border-line bg-surface text-fg-muted hover:bg-surface-muted'
                        }`}
                      >
                        {t.newLogicFromLocalDraft}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeedFromLocal(false)}
                        className={`h-9 rounded border px-2 text-xs font-medium transition-colors ${
                          seedFromLocal
                            ? 'border-line bg-surface text-fg-muted hover:bg-surface-muted'
                            : 'border-brand-border-strong bg-brand-subtle text-brand-fg-strong'
                        }`}
                      >
                        {t.newLogicBlank}
                      </button>
                    </div>
                    {seedFromLocal ? (
                      <span className="mt-1 block text-xs leading-5 text-fg-subtle">
                        {t.newLogicFromLocalDraftHint}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.logicNameLabel}
                  </span>
                  <input
                    value={logicName}
                    onChange={(event) => {
                      const nextName = event.target.value;
                      setLogicName(nextName);
                      if (!logicIdEdited) {
                        setLogicStableId(logicIdFromName(nextName));
                      }
                    }}
                    required
                    maxLength={120}
                    className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    placeholder={t.logicNamePlaceholder}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.logicIdLabel}
                  </span>
                  <input
                    value={logicStableId}
                    onChange={(event) => {
                      setLogicIdEdited(true);
                      setLogicStableId(event.target.value);
                    }}
                    required
                    maxLength={63}
                    pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
                    className="h-10 w-full rounded border border-line bg-surface px-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    placeholder={t.logicIdPlaceholder}
                  />
                  <span className="mt-1 block text-xs leading-5 text-fg-subtle">
                    {t.logicIdHint}
                  </span>
                  {trimmedLogicStableId && !logicStableIdValid ? (
                    <span className="mt-1 block text-xs text-danger-fg">
                      {t.logicIdInvalid}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.logicDescriptionLabel}
                  </span>
                  <textarea
                    value={logicDescription}
                    onChange={(event) =>
                      setLogicDescription(event.target.value)
                    }
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    placeholder={t.logicDescriptionPlaceholder}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={
              saveState === 'saving' || !orgId || !logicId || !logicFormValid
            }
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saveState === 'saving' ? t.connecting : t.useSelectedWorkspace}
          </button>
        </form>
      </div>
    </div>
  );
}
