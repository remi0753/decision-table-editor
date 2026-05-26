import { Cloud, Plus } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { useLogicStore } from '@/store/logicStore';

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
    setLogicName(logic.name);
    setLogicDescription(logic.description ?? '');
    if (!logicIdEdited) setLogicStableId(logicIdFromName(logic.name));
  }, [logic.description, logic.name, logicIdEdited]);

  if (mode !== 'selecting' || !choices) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!orgId) return;
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
      logic,
      importLogic,
    );
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
    <div className="fixed inset-0 z-[80] bg-white/85 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded border border-gray-200 bg-white p-5 shadow-xl"
        >
          <div className="mb-5 flex items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Choose cloud workspace
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Select where this editor session should load and save.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Organization
              </span>
              <select
                value={orgId}
                onChange={(event) => setOrgId(event.target.value)}
                className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
              >
                {choices.orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Workspace
              </span>
              <select
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
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
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Logic
              </span>
              <select
                value={logicId}
                onChange={(event) => setLogicId(event.target.value)}
                className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
              >
                {logics.map((cloudLogic) => (
                  <option key={cloudLogic.id} value={cloudLogic.id}>
                    {cloudLogic.name}
                  </option>
                ))}
                {canCreateLogic ? (
                  <option value={NEW_LOGIC}>
                    Create new from current draft
                  </option>
                ) : null}
                {!canCreateLogic && logics.length === 0 ? (
                  <option value="">No shared runners available</option>
                ) : null}
              </select>
            </label>

            {creatingNewLogic && canCreateLogic ? (
              <div className="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
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
                    className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    placeholder={t.logicNamePlaceholder}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
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
                    className="h-10 w-full rounded border border-gray-200 bg-white px-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    placeholder={t.logicIdPlaceholder}
                  />
                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    {t.logicIdHint}
                  </span>
                  {trimmedLogicStableId && !logicStableIdValid ? (
                    <span className="mt-1 block text-xs text-red-600">
                      {t.logicIdInvalid}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    {t.logicDescriptionLabel}
                  </span>
                  <textarea
                    value={logicDescription}
                    onChange={(event) =>
                      setLogicDescription(event.target.value)
                    }
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
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
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saveState === 'saving' ? t.connecting : t.useSelectedWorkspace}
          </button>
        </form>
      </div>
    </div>
  );
}
