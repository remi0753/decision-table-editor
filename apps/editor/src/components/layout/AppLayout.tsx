import type { Logic } from '@leverie/engine';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  BookOpen,
  Code2,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Loader2,
  Menu,
  Redo2,
  Rocket,
  RotateCcw,
  Share2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { ApiUsageDialog } from '@/components/cloud/ApiUsageDialog';
import { CloudMenu } from '@/components/cloud/CloudMenu';
import { CloudWorkspacePicker } from '@/components/cloud/CloudWorkspacePicker';
import { PublishDiffReviewDialog } from '@/components/cloud/PublishDiffReviewDialog';
import { RunnerShareDialog } from '@/components/cloud/RunnerShareDialog';
import { BatchDialog } from '@/components/evaluation/BatchDialog';
import { DeleteLogicDialog } from '@/components/logic/DeleteLogicDialog';
import { LogicSwitcherDialog } from '@/components/logic/LogicSwitcherDialog';
import { LocalOnboarding } from '@/components/onboarding/LocalOnboarding';
import { SampleGalleryDialog } from '@/components/templates/SampleGalleryDialog';
import { IconButton } from '@/components/ui/IconButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Tooltip } from '@/components/ui/Tooltip';
import { useCloudAutoSave } from '@/hooks/useCloudAutoSave';
import { exportLogic, useImportLogic } from '@/hooks/useImportExport';
import { useAutoSave } from '@/hooks/useLocalStorage';
import type { Lang } from '@/i18n/translations';
import { useT } from '@/i18n/useT';
import {
  type CloudLogic,
  type CloudMyLogics,
  getMyLogics,
  listLogics,
} from '@/lib/cloudApi';
import { useCloudStore } from '@/store/cloudStore';
import {
  clearHistory,
  redo,
  undo,
  useHistoryStore,
} from '@/store/historyStore';
import {
  clearLogicContent,
  createInitialLogic,
  useLogicStore,
} from '@/store/logicStore';
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

function canEdit(role: string | null) {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

// Duplicating prefills the dialog from the source logic, whose name/slug already
// exist in the workspace. Suffix both so the create call does not 409 on the
// slug uniqueness constraint (and so two identically named logics don't appear).
function uniqueLogicNameAmong(baseName: string, existing: CloudLogic[]) {
  const names = new Set(existing.map((l) => l.name));
  if (!names.has(baseName)) return baseName;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${baseName} ${n}`;
    if (!names.has(candidate)) return candidate;
  }
  return `${baseName} ${Date.now()}`;
}

function uniqueLogicSlugAmong(baseSlug: string, existing: CloudLogic[]) {
  const slugs = new Set(existing.map((l) => l.slug));
  if (!slugs.has(baseSlug)) return baseSlug;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${baseSlug}-${n}`.slice(0, 63).replace(/-+$/g, '');
    if (!slugs.has(candidate)) return candidate;
  }
  return `${baseSlug}-${Date.now()}`.slice(0, 63).replace(/-+$/g, '');
}

export function AppLayout({
  localOnboardingEnabled = false,
}: {
  localOnboardingEnabled?: boolean;
}) {
  const logic = useLogicStore((s) => s.logic);
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
  const orgRole = useCloudStore((s) => s.orgRole);
  const workspace = useCloudStore((s) => s.workspace);
  const logicId = useCloudStore((s) => s.logicId);
  const logicSlug = useCloudStore((s) => s.logicSlug);
  const latestVersion = useCloudStore((s) => s.latestVersion);
  const logicCanDelete = useCloudStore((s) => s.logicCanDelete);
  const productionVersion = useCloudStore((s) => s.productionVersion);
  const saveState = useCloudStore((s) => s.saveState);
  const createCloudLogicFrom = useCloudStore((s) => s.createCloudLogicFrom);
  const deleteCloudLogic = useCloudStore((s) => s.deleteCloudLogic);
  const publishCloudLogic = useCloudStore((s) => s.publishCloudLogic);
  const t = useT();
  const [sampleGalleryOpen, setSampleGalleryOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [logicDialogOpen, setLogicDialogOpen] = useState(false);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [newCloudLogicOpen, setNewCloudLogicOpen] = useState(false);
  const [newLogicName, setNewLogicName] = useState(t.initialLogicName);
  const [newLogicId, setNewLogicId] = useState(
    logicIdFromName(t.initialLogicName),
  );
  const [newLogicDescription, setNewLogicDescription] = useState('');
  const [newLogicIdEdited, setNewLogicIdEdited] = useState(false);
  const [pendingNewLogic, setPendingNewLogic] = useState<Logic | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLogic, setDeletingLogic] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [logicSlots, setLogicSlots] = useState<CloudMyLogics | null>(null);
  const [existingLogics, setExistingLogics] = useState<CloudLogic[]>([]);
  const runImport = useImportLogic();

  // AppLayout only mounts once the viewport supports the editor (or the visitor
  // dismissed the mobile gate); the gate decision lives in EditorRoute.
  useAutoSave(logic, cloudMode === 'local');
  useCloudAutoSave(logic, true);

  const prefillNewLogicFrom = (base: Logic, existing: CloudLogic[]) => {
    const name = uniqueLogicNameAmong(base.name, existing);
    setNewLogicName(name);
    setNewLogicId(uniqueLogicSlugAmong(logicIdFromName(name), existing));
    setNewLogicDescription(base.description ?? '');
    setNewLogicIdEdited(false);
    setPendingNewLogic(base);
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

  const openNewLogicDialog = async (nextLogic: Logic) => {
    // Pull the workspace's current logics so the prefill can dodge name/slug
    // collisions up front and the dialog can flag any the user types back in.
    let existing: CloudLogic[] = [];
    if (workspace) {
      try {
        existing = (await listLogics(workspace.id)).logics;
      } catch {
        existing = [];
      }
    }
    setExistingLogics(existing);
    prefillNewLogicFrom(nextLogic, existing);
    setNewCloudLogicOpen(true);
  };

  const handleCreateFromSample = (sampleLogic: Logic) => {
    if (cloudMode === 'cloud') {
      void openNewLogicDialog(sampleLogic);
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

  const handleStartOver = () => {
    if (!window.confirm(t.startOverConfirm)) return;
    applyLogicToEditor(clearLogicContent(logic));
    toast.success(t.startOverDone);
  };

  const trimmedNewLogicName = newLogicName.trim();
  const trimmedNewLogicId = newLogicId.trim();
  const newLogicIdValid = LOGIC_ID_PATTERN.test(trimmedNewLogicId);
  const newLogicIdTaken = existingLogics.some(
    (l) => l.slug === trimmedNewLogicId,
  );
  const newLogicNameTaken = existingLogics.some(
    (l) => l.name === trimmedNewLogicName,
  );
  // The server only rejects slug clashes, so the slug is the hard block; a
  // duplicate name is allowed but worth flagging so the user can disambiguate.
  const newCloudLogicValid =
    trimmedNewLogicName.length > 0 && newLogicIdValid && !newLogicIdTaken;

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
    setNewCloudLogicOpen(false);
    setPendingNewLogic(null);
    setSelectedTable(nextLogic.entryTableId);
    clearEvalInputs();
    clearEvalResult();
    clearBatch();
    clearHistory();
    setEvalDrawerOpen(true);
  };

  const editableCloudLogic =
    cloudMode === 'cloud' && Boolean(logicId) && canEdit(orgRole);
  // logicCanDelete already encodes the role + ownership rule from the server, so
  // the menu item only needs a current cloud logic on top of it.
  const deletableCloudLogic =
    cloudMode === 'cloud' && Boolean(logicId) && logicCanDelete;
  const isLocalMode = cloudMode === 'local';
  // Each account has a fixed logic-slot budget; once it's full the server
  // rejects creation, so disable Duplicate up front instead of failing on click.
  const atLogicLimit =
    logicSlots !== null && logicSlots.used >= logicSlots.limit;

  const refreshLogicSlots = async () => {
    try {
      setLogicSlots(await getMyLogics());
    } catch {
      setLogicSlots(null);
    }
  };

  const handleDeleteCurrentLogic = async () => {
    if (!logicId || deletingLogic) return;
    setDeletingLogic(true);
    try {
      await deleteCloudLogic(logicId, importLogic);
      // The store loaded the next (or a blank) logic; point the editor at its
      // entry table so the view below the dialog stays valid.
      setSelectedTable(useLogicStore.getState().logic.entryTableId);
      toast.success(t.deleteLogicSuccess);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.cloudError);
    } finally {
      setDeletingLogic(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Toaster position="top-right" richColors />

      {/* Header and body share one horizontal scroll so they stay aligned and
          the full editor — including the header controls — stays reachable on
          narrow viewports (phones past the mobile gate, small desktop windows)
          instead of being squeezed to the device width. The min-width is the
          editor's natural floor: left pane (320) + table (≥360) + evaluation
          panel (360). */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-[1040px] flex-col">
          <header className="h-12 border-b border-brand-border bg-gradient-to-r from-brand-subtle to-surface flex items-center justify-between px-3 shrink-0 gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logoUrl}
                alt="LEVERIE"
                height={34}
                className="h-[34px]"
              />
              <Tooltip
                content={
                  <span className="flex max-w-64 flex-col gap-0.5">
                    <span className="truncate">{logic.name}</span>
                    <span className="text-[11px] text-white/75">
                      {productionVersion
                        ? t.productionVersionLabel(
                            productionVersion.versionNumber,
                          )
                        : t.draftOnly}
                    </span>
                  </span>
                }
              >
                <button
                  type="button"
                  onClick={() => setLogicDialogOpen(true)}
                  className="inline-flex h-8 max-w-[320px] min-w-0 items-center gap-2 rounded-full border border-brand-border bg-white/25 px-3 text-left text-xs font-medium text-fg-secondary shadow-none backdrop-blur-[1px] hover:bg-white/65 hover:text-brand-fg-strong focus:outline-none focus:ring-1 focus:ring-brand-ring"
                  aria-label={t.switchLogic}
                >
                  <FileText className="h-4 w-4 shrink-0 text-brand-fg" />
                  <span className="min-w-0 flex leading-tight">
                    <span className="truncate text-sm font-light">
                      {logic.name}
                    </span>
                  </span>
                </button>
              </Tooltip>
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
              {editableCloudLogic ? (
                <Tooltip content={t.publish}>
                  <button
                    type="button"
                    onClick={() => setPublishReviewOpen(true)}
                    disabled={saveState === 'saving'}
                    className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded border border-success-border bg-success-bg px-3 text-xs font-semibold text-success-fg hover:bg-success-bg disabled:opacity-50"
                  >
                    <Rocket className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.publish}</span>
                  </button>
                </Tooltip>
              ) : null}
              <DropdownMenu.Root
                onOpenChange={(open) => {
                  if (open && editableCloudLogic) void refreshLogicSlots();
                }}
              >
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
                      {t.thisLogicActions}
                    </DropdownMenu.Label>
                    {editableCloudLogic ? (
                      <>
                        <DropdownMenu.Item
                          onSelect={() => setShareOpen(true)}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                        >
                          <Share2 className="h-4 w-4 text-fg-faint" />
                          <span>{t.shareRunner}</span>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => setApiOpen(true)}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                        >
                          <Code2 className="h-4 w-4 text-fg-faint" />
                          <span>{t.useViaApi}</span>
                        </DropdownMenu.Item>
                        {atLogicLimit ? (
                          <Tooltip
                            side="left"
                            content={
                              <span className="flex max-w-56 flex-col gap-0.5">
                                <span>{t.logicLimitReached}</span>
                                {logicSlots ? (
                                  <span className="text-white/75">
                                    {t.logicSlotsUsage(
                                      logicSlots.used,
                                      logicSlots.limit,
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            }
                          >
                            <DropdownMenu.Item
                              disabled
                              className="flex cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-faint opacity-60 outline-none data-[disabled]:pointer-events-auto"
                            >
                              <Copy className="h-4 w-4 text-fg-faint" />
                              <span>{t.duplicateLogic}</span>
                            </DropdownMenu.Item>
                          </Tooltip>
                        ) : (
                          <DropdownMenu.Item
                            onSelect={() => void openNewLogicDialog(logic)}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                          >
                            <Copy className="h-4 w-4 text-fg-faint" />
                            <span>{t.duplicateLogic}</span>
                          </DropdownMenu.Item>
                        )}
                      </>
                    ) : null}
                    {isLocalMode ? (
                      <>
                        <DropdownMenu.Item
                          onSelect={runImport}
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
                        <DropdownMenu.Item
                          onSelect={handleStartOver}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-secondary outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong"
                        >
                          <RotateCcw className="h-4 w-4 text-fg-faint" />
                          <span>{t.startOver}</span>
                        </DropdownMenu.Item>
                      </>
                    ) : null}
                    {deletableCloudLogic ? (
                      <DropdownMenu.Item
                        onSelect={() => setDeleteDialogOpen(true)}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-danger-fg outline-none data-[highlighted]:bg-danger-bg"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>{t.deleteLogic}</span>
                      </DropdownMenu.Item>
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
            <aside className="w-80 border-r bg-surface overflow-hidden flex flex-col shrink-0">
              <LeftPane />
            </aside>
            <main className="flex-1 min-w-0 overflow-hidden bg-surface">
              <RightPane
                onOpenSampleGallery={() => setSampleGalleryOpen(true)}
              />
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
        </div>
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
      <LogicSwitcherDialog
        open={logicDialogOpen}
        onOpenChange={setLogicDialogOpen}
      />
      <DeleteLogicDialog
        open={deleteDialogOpen}
        onOpenChange={(next) => {
          if (!next && !deletingLogic) setDeleteDialogOpen(false);
        }}
        logicName={logic.name}
        hasProduction={Boolean(productionVersion)}
        deleting={deletingLogic}
        onConfirm={handleDeleteCurrentLogic}
      />
      {shareOpen && logicId ? (
        <RunnerShareDialog
          logicId={logicId}
          latestVersion={latestVersion}
          productionVersion={productionVersion}
          onPublish={() => publishCloudLogic(logic)}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      {apiOpen && logicId ? (
        <ApiUsageDialog
          logic={logic}
          logicId={logicId}
          logicSlug={logicSlug}
          latestVersion={latestVersion}
          productionVersion={productionVersion}
          onPublish={() => publishCloudLogic(logic)}
          onClose={() => setApiOpen(false)}
        />
      ) : null}
      {publishReviewOpen && logicId ? (
        <PublishDiffReviewDialog
          logicId={logicId}
          draftLogic={logic}
          hasPreviousVersion={Boolean(productionVersion)}
          onPublish={() => publishCloudLogic(logic)}
          onClose={() => setPublishReviewOpen(false)}
        />
      ) : null}
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
                {newLogicNameTaken ? (
                  <span className="mt-1 block text-xs text-warning-fg">
                    {t.logicNameTaken}
                  </span>
                ) : null}
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
                ) : newLogicIdValid && newLogicIdTaken ? (
                  <span className="mt-1 block text-xs text-danger-fg">
                    {t.logicIdTaken}
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
