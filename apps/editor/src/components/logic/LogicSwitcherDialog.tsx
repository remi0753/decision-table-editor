import * as Dialog from '@radix-ui/react-dialog';
import {
  Check,
  ChevronLeft,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n/useT';
import { type CloudLogic, listLogics, saveDraft } from '@/lib/cloudApi';
import { useCloudStore } from '@/store/cloudStore';
import { createInitialLogic, useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

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

function canEdit(role: string | null) {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

type DetailTarget =
  | { type: 'local' }
  | { type: 'cloud'; logic: CloudLogic }
  | { type: 'new' };

export function LogicSwitcherDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const currentLogic = useLogicStore((s) => s.logic);
  const importLogic = useLogicStore((s) => s.importLogic);
  const setLogicName = useLogicStore((s) => s.setLogicName);
  const setLogicDescription = useLogicStore((s) => s.setLogicDescription);
  const mode = useCloudStore((s) => s.mode);
  const workspace = useCloudStore((s) => s.workspace);
  const orgRole = useCloudStore((s) => s.orgRole);
  const logicId = useCloudStore((s) => s.logicId);
  const switchCloudLogic = useCloudStore((s) => s.switchCloudLogic);
  const createCloudLogicFrom = useCloudStore((s) => s.createCloudLogicFrom);
  const saveCloudDraft = useCloudStore((s) => s.saveCloudDraft);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [target, setTarget] = useState<DetailTarget>({ type: 'local' });
  const [logics, setLogics] = useState<CloudLogic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');

  const editable = mode !== 'cloud' || canEdit(orgRole);
  const isCloud = mode === 'cloud' && Boolean(workspace);

  const loadWorkspaceLogics = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const result = await listLogics(workspace.id);
      setLogics(result.logics);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load logics.',
      );
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    if (isCloud) {
      setView('list');
      void loadWorkspaceLogics();
    } else {
      setTarget({ type: 'local' });
      setDraftName(currentLogic.name);
      setDraftDescription(currentLogic.description ?? '');
      setView('detail');
    }
  }, [
    open,
    isCloud,
    currentLogic.name,
    currentLogic.description,
    loadWorkspaceLogics,
  ]);

  const filteredLogics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return logics;
    return logics.filter((logic) =>
      `${logic.name} ${logic.description ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [logics, query]);

  const openDetail = (nextTarget: DetailTarget) => {
    setTarget(nextTarget);
    if (nextTarget.type === 'local') {
      setDraftName(currentLogic.name);
      setDraftDescription(currentLogic.description ?? '');
    } else if (nextTarget.type === 'new') {
      setDraftName(t.initialLogicName);
      setDraftDescription('');
    } else {
      setDraftName(nextTarget.logic.name);
      setDraftDescription(nextTarget.logic.description ?? '');
    }
    setView('detail');
  };

  const handleSwitch = async (cloudLogic: CloudLogic) => {
    if (cloudLogic.id === logicId) {
      onOpenChange(false);
      return;
    }
    await switchCloudLogic(cloudLogic.id, importLogic);
    setSelectedTable(cloudLogic.draftData.entryTableId);
    onOpenChange(false);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!editable || saving) return;

    const name = draftName.trim();
    if (!name) return;
    const description = draftDescription.trim() || undefined;

    setSaving(true);
    try {
      if (target.type === 'local') {
        setLogicName(name);
        setLogicDescription(description ?? '');
        onOpenChange(false);
        return;
      }

      if (target.type === 'new') {
        const nextLogic = {
          ...createInitialLogic(),
          name,
          description,
        };
        await createCloudLogicFrom(
          nextLogic,
          {
            name,
            slug: logicIdFromName(name),
            description,
          },
          importLogic,
        );
        setSelectedTable(nextLogic.entryTableId);
        onOpenChange(false);
        return;
      }

      const nextLogic = {
        ...target.logic.draftData,
        name,
        description,
      };

      if (target.logic.id === logicId) {
        importLogic(nextLogic);
        await saveCloudDraft(nextLogic);
      } else {
        const result = await saveDraft({
          logicId: target.logic.id,
          logic: nextLogic,
          draftRevision: target.logic.draftRevision,
        });
        setLogics((items) =>
          items.map((item) =>
            item.id === result.logic.id ? result.logic : item,
          ),
        );
      }
      setView('list');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.cloudError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] flex max-h-[min(680px,calc(100vh-2rem))] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-xl">
          {view === 'list' && isCloud ? (
            <>
              <div className="border-b border-line px-4 py-3">
                <Dialog.Title className="text-base font-semibold text-fg">
                  {t.logicDialogTitle}
                </Dialog.Title>
                <div className="mt-3 flex h-9 items-center gap-2 rounded border border-line bg-surface-muted px-2.5">
                  <Search className="h-4 w-4 shrink-0 text-fg-faint" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg-secondary outline-none placeholder:text-fg-faint"
                    placeholder={t.logicSearchPlaceholder}
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {loading ? (
                  <div className="flex items-center gap-2 px-3 py-6 text-sm text-fg-subtle">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.cloudChecking}
                  </div>
                ) : (
                  filteredLogics.map((cloudLogic) => (
                    <button
                      key={cloudLogic.id}
                      type="button"
                      onClick={() => void handleSwitch(cloudLogic)}
                      className="flex w-full min-w-0 items-center gap-3 rounded px-3 py-2.5 text-left hover:bg-brand-subtle focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    >
                      {cloudLogic.id === logicId ? (
                        <Check className="h-4 w-4 shrink-0 text-success-fg" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-fg-faint" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg-secondary">
                          {cloudLogic.name}
                        </span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {cloudLogic.productionVersionId
                            ? t.publishedStatus
                            : t.draftOnly}{' '}
                          · {t.draftRevisionLabel(cloudLogic.draftRevision)}
                        </span>
                      </span>
                      {editable ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetail({ type: 'cloud', logic: cloudLogic });
                          }}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-fg-faint hover:bg-surface hover:text-brand-fg"
                          aria-label={t.editLogic}
                          title={t.editLogic}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </button>
                  ))
                )}
                {!loading && filteredLogics.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-fg-subtle">
                    {t.logicListEmpty}
                  </div>
                ) : null}
              </div>
              {editable ? (
                <div className="border-t border-line p-3">
                  <button
                    type="button"
                    onClick={() => openDetail({ type: 'new' })}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-brand-border-strong bg-brand-subtle px-3 text-sm font-medium text-brand-fg-strong hover:bg-brand-subtle"
                  >
                    <Plus className="h-4 w-4" />
                    {t.createNewLogic}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <form onSubmit={handleSave}>
              <div className="border-b border-line px-4 py-3">
                {isCloud ? (
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-brand-fg"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {t.backToLogicList}
                  </button>
                ) : null}
                <Dialog.Title className="text-base font-semibold text-fg">
                  {target.type === 'new' ? t.createNewLogic : t.logicEditTitle}
                </Dialog.Title>
              </div>
              <div className="space-y-4 p-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.logicNameLabel}
                  </span>
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    required
                    maxLength={120}
                    disabled={!editable}
                    className="h-10 w-full rounded border border-line bg-surface px-3 text-sm text-fg-secondary focus:outline-none focus:ring-1 focus:ring-brand-ring disabled:bg-surface-muted disabled:text-fg-subtle"
                    placeholder={t.logicNamePlaceholder}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.logicDescriptionLabel}
                  </span>
                  <textarea
                    value={draftDescription}
                    onChange={(event) =>
                      setDraftDescription(event.target.value)
                    }
                    maxLength={500}
                    rows={4}
                    disabled={!editable}
                    className="w-full resize-none rounded border border-line bg-surface px-3 py-2 text-sm text-fg-secondary focus:outline-none focus:ring-1 focus:ring-brand-ring disabled:bg-surface-muted disabled:text-fg-subtle"
                    placeholder={t.logicDescriptionPlaceholder}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-line p-3">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="h-9 rounded border border-line bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted"
                  >
                    {t.cancel}
                  </button>
                </Dialog.Close>
                {editable ? (
                  <button
                    type="submit"
                    disabled={saving || draftName.trim().length === 0}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {t.save}
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
