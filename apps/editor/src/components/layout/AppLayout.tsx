import type { Logic } from '@leverie/engine';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  BookOpen,
  Download,
  FilePlus,
  FlaskConical,
  Loader2,
  Menu,
  Redo2,
  Undo2,
  Upload,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { CloudMenu } from '@/components/cloud/CloudMenu';
import { CloudWorkspacePicker } from '@/components/cloud/CloudWorkspacePicker';
import { BatchDialog } from '@/components/evaluation/BatchDialog';
import { LocalOnboarding } from '@/components/onboarding/LocalOnboarding';
import { SampleGalleryDialog } from '@/components/templates/SampleGalleryDialog';
import { IconButton } from '@/components/ui/IconButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Tooltip } from '@/components/ui/Tooltip';
import { useCloudAutoSave } from '@/hooks/useCloudAutoSave';
import { exportLogic, useImportLogic } from '@/hooks/useImportExport';
import {
  clearMigrationDraft,
  loadMigrationDraft,
  useAutoSave,
} from '@/hooks/useLocalStorage';
import type { Lang } from '@/i18n/translations';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import {
  clearHistory,
  redo,
  undo,
  useHistoryStore,
} from '@/store/historyStore';
import { createInitialLogic, useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { LeftPane } from './LeftPane';
import { RightPane } from './RightPane';

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

export function AppLayout({
  localOnboardingEnabled = false,
}: {
  localOnboardingEnabled?: boolean;
}) {
  const logic = useLogicStore((s) => s.logic);
  const resetLogic = useLogicStore((s) => s.resetLogic);
  const importLogic = useLogicStore((s) => s.importLogic);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const setEvalDrawerOpen = useUiStore((s) => s.setEvalDrawerOpen);
  const clearEvalInputs = useUiStore((s) => s.clearEvalInputs);
  const clearEvalResult = useUiStore((s) => s.clearEvalResult);
  const clearBatch = useUiStore((s) => s.clearBatch);
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const cloudMode = useCloudStore((s) => s.mode);
  const createCloudLogicFrom = useCloudStore((s) => s.createCloudLogicFrom);
  const importFn = useImportLogic();
  const t = useT();
  const [sampleGalleryOpen, setSampleGalleryOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [newCloudLogicOpen, setNewCloudLogicOpen] = useState(false);
  const [newLogicName, setNewLogicName] = useState(t.initialLogicName);
  const [newLogicId, setNewLogicId] = useState(
    logicIdFromName(t.initialLogicName),
  );
  const [newLogicDescription, setNewLogicDescription] = useState('');
  const [newLogicIdEdited, setNewLogicIdEdited] = useState(false);
  const [pendingNewLogic, setPendingNewLogic] = useState<Logic | null>(null);
  // A local draft preserved when the user signed in from local mode. When set,
  // the new-logic dialog offers starting the new cloud logic from it.
  const [newLogicStash, setNewLogicStash] = useState<Logic | null>(null);
  const [newLogicFromLocal, setNewLogicFromLocal] = useState(false);

  useAutoSave(logic, cloudMode === 'local');
  useCloudAutoSave(logic);

  const prefillNewLogicFrom = (base: Logic) => {
    setNewLogicName(base.name);
    setNewLogicId(logicIdFromName(base.name));
    setNewLogicDescription(base.description ?? '');
    setNewLogicIdEdited(false);
    setPendingNewLogic(base);
  };

  // Switch the new-logic dialog between starting blank and starting from the
  // preserved local draft, re-prefilling the form from the chosen source.
  const selectNewLogicSource = (fromLocal: boolean) => {
    setNewLogicFromLocal(fromLocal);
    prefillNewLogicFrom(
      fromLocal && newLogicStash ? newLogicStash : createInitialLogic(),
    );
  };

  const handleNew = () => {
    if (window.confirm(t.newLogicConfirm)) {
      if (cloudMode === 'cloud') {
        // Default to a blank logic; offer the preserved local draft as an
        // opt-in source if one is pending.
        setNewLogicStash(loadMigrationDraft());
        setNewLogicFromLocal(false);
        prefillNewLogicFrom(createInitialLogic());
        setNewCloudLogicOpen(true);
      } else {
        resetLogic();
        clearEvalResult();
        clearBatch();
        clearHistory();
      }
    }
  };

  const applyLogicToEditor = (nextLogic: Logic) => {
    importLogic(nextLogic);
    setSelectedTable(nextLogic.entryTableId);
    clearEvalInputs();
    clearEvalResult();
    clearBatch();
    clearHistory();
    setEvalDrawerOpen(true);
  };

  const openNewLogicDialog = (nextLogic: Logic) => {
    // Opened from a sample: the sample is the source, so don't offer the
    // local-draft choice.
    setNewLogicStash(null);
    setNewLogicFromLocal(false);
    prefillNewLogicFrom(nextLogic);
    setNewCloudLogicOpen(true);
  };

  const handleCreateFromSample = (sampleLogic: Logic) => {
    if (cloudMode === 'cloud') {
      openNewLogicDialog(sampleLogic);
      return;
    }
    if (!window.confirm(t.createSampleLocalConfirm(sampleLogic.name))) return;
    applyLogicToEditor(sampleLogic);
    toast.success(t.sampleLoaded(sampleLogic.name));
  };

  const handleReplaceWithSample = (sampleLogic: Logic) => {
    if (!window.confirm(t.replaceWithSampleConfirm(sampleLogic.name))) return;
    applyLogicToEditor(sampleLogic);
    toast.success(t.sampleLoaded(sampleLogic.name));
  };

  const trimmedNewLogicName = newLogicName.trim();
  const trimmedNewLogicId = newLogicId.trim();
  const newLogicIdValid = LOGIC_ID_PATTERN.test(trimmedNewLogicId);
  const newCloudLogicValid = trimmedNewLogicName.length > 0 && newLogicIdValid;

  const handleCreateCloudLogic = (event: FormEvent) => {
    event.preventDefault();
    if (!newCloudLogicValid) return;
    const description = newLogicDescription.trim() || undefined;
    const nextLogic = {
      ...(pendingNewLogic ?? createInitialLogic()),
      name: trimmedNewLogicName,
      description,
    };
    void createCloudLogicFrom(
      nextLogic,
      {
        name: trimmedNewLogicName,
        slug: trimmedNewLogicId,
        description,
      },
      importLogic,
    );
    if (newLogicFromLocal) clearMigrationDraft();
    setNewLogicStash(null);
    setNewCloudLogicOpen(false);
    setPendingNewLogic(null);
    setSelectedTable(nextLogic.entryTableId);
    clearEvalInputs();
    clearEvalResult();
    clearBatch();
    clearHistory();
    setEvalDrawerOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Toaster position="top-right" richColors />

      <header className="h-12 border-b border-brand-border bg-gradient-to-r from-brand-subtle to-surface flex items-center justify-between px-3 shrink-0 gap-4">
        <div className="flex min-w-0 items-center">
          <img src={logoUrl} alt="LEVERIE" height={34} className="h-[34px]" />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={t.undo}>
            <IconButton
              size="md"
              tone="primary"
              onClick={undo}
              disabled={!canUndo}
              aria-label={t.undo}
            >
              <Undo2 />
            </IconButton>
          </Tooltip>
          <Tooltip content={t.redo}>
            <IconButton
              size="md"
              tone="primary"
              onClick={redo}
              disabled={!canRedo}
              aria-label={t.redo}
            >
              <Redo2 />
            </IconButton>
          </Tooltip>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton
                size="md"
                tone="primary"
                aria-label={t.moreActions}
                title={t.moreActions}
              >
                <Menu />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[220px] rounded-md border border-line bg-surface p-1 shadow-lg"
              >
                <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
                  {t.fileActions}
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  onSelect={handleNew}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                >
                  <FilePlus className="h-4 w-4 text-fg-faint" />
                  <span>{t.newCreate}</span>
                </DropdownMenu.Item>
                {/* File-based backup/restore is the local-mode safety net;
                    cloud mode persists via autosave + publish, so it's hidden
                    there. */}
                {cloudMode === 'local' ? (
                  <>
                    <DropdownMenu.Item
                      onSelect={importFn}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                    >
                      <Upload className="h-4 w-4 text-fg-faint" />
                      <span>{t.importBtn}</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => exportLogic(logic)}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                    >
                      <Download className="h-4 w-4 text-fg-faint" />
                      <span>{t.exportBtn}</span>
                    </DropdownMenu.Item>
                  </>
                ) : null}
                <DropdownMenu.Separator className="my-1 h-px bg-surface-subtle" />
                <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
                  {t.toolActions}
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  onSelect={() => setBatchDialogOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                >
                  <FlaskConical className="h-4 w-4 text-fg-faint" />
                  <span>{t.batchTest}</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <div className="w-px h-5 bg-surface-strong" />
          <a
            href="/docs/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-fg-subtle hover:bg-brand-subtle hover:text-brand-fg focus:outline-none focus:ring-1 focus:ring-brand-ring"
          >
            <BookOpen className="h-4 w-4" />
            <span>{t.docsLink}</span>
          </a>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="text-xs border border-line rounded px-2 py-1.5 bg-surface hover:bg-brand-subtle hover:border-brand-border text-fg-subtle font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-ring"
          >
            <option value="en">EN</option>
            <option value="ja">日本語</option>
          </select>
          <ThemeToggle />
          <div className="w-px h-5 bg-surface-strong" />
          <CloudMenu />
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <aside className="w-80 border-r bg-surface-muted overflow-hidden flex flex-col shrink-0">
          <LeftPane />
        </aside>
        <main className="flex-1 overflow-hidden bg-surface-muted">
          <RightPane onOpenSampleGallery={() => setSampleGalleryOpen(true)} />
        </main>
        {cloudMode === 'checking' ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-surface/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-fg-secondary">
              <Loader2 className="h-7 w-7 animate-spin text-brand-fg" />
              <div className="text-sm font-medium">{t.cloudChecking}</div>
            </div>
          </div>
        ) : null}
      </div>

      <SampleGalleryDialog
        open={sampleGalleryOpen}
        onOpenChange={setSampleGalleryOpen}
        onCreateFromSample={handleCreateFromSample}
        onReplaceCurrent={handleReplaceWithSample}
      />
      <BatchDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        logic={logic}
      />
      <CloudWorkspacePicker />
      <LocalOnboarding
        enabled={localOnboardingEnabled && cloudMode === 'local'}
      />
      {newCloudLogicOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6">
          <form
            onSubmit={handleCreateCloudLogic}
            className="w-full max-w-md rounded border border-line bg-surface p-5 shadow-xl"
          >
            <h2 className="text-base font-semibold text-fg">
              {t.createCloudLogicTitle}
            </h2>
            <div className="mt-4 space-y-3">
              {newLogicStash ? (
                <div>
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.newLogicSourceLabel}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => selectNewLogicSource(true)}
                      className={`h-9 rounded border px-2 text-xs font-medium transition-colors ${
                        newLogicFromLocal
                          ? 'border-brand-border-strong bg-brand-subtle text-brand-fg-strong'
                          : 'border-line bg-surface text-fg-muted hover:bg-surface-muted'
                      }`}
                    >
                      {t.newLogicFromLocalDraft}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectNewLogicSource(false)}
                      className={`h-9 rounded border px-2 text-xs font-medium transition-colors ${
                        newLogicFromLocal
                          ? 'border-line bg-surface text-fg-muted hover:bg-surface-muted'
                          : 'border-brand-border-strong bg-brand-subtle text-brand-fg-strong'
                      }`}
                    >
                      {t.newLogicBlank}
                    </button>
                  </div>
                  {newLogicFromLocal ? (
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
                  value={newLogicName}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setNewLogicName(nextName);
                    if (!newLogicIdEdited) {
                      setNewLogicId(logicIdFromName(nextName));
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
                  value={newLogicId}
                  onChange={(event) => {
                    setNewLogicIdEdited(true);
                    setNewLogicId(event.target.value);
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
                {trimmedNewLogicId && !newLogicIdValid ? (
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
                  value={newLogicDescription}
                  onChange={(event) =>
                    setNewLogicDescription(event.target.value)
                  }
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                  placeholder={t.logicDescriptionPlaceholder}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewCloudLogicOpen(false);
                  setPendingNewLogic(null);
                }}
                className="h-9 rounded border border-line bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={!newCloudLogicValid}
                className="h-9 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
              >
                {t.createCloudLogicSubmit}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
