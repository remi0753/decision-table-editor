import {
  Download,
  FilePlus,
  FlaskConical,
  Redo2,
  Sparkles,
  Undo2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Toaster } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { CloudMenu } from '@/components/cloud/CloudMenu';
import { CloudWorkspacePicker } from '@/components/cloud/CloudWorkspacePicker';
import { BatchDialog } from '@/components/evaluation/BatchDialog';
import { SampleGalleryDialog } from '@/components/templates/SampleGalleryDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useCloudAutoSave } from '@/hooks/useCloudAutoSave';
import { exportLogic, useImportLogic } from '@/hooks/useImportExport';
import { useAutoSave } from '@/hooks/useLocalStorage';
import type { Lang } from '@/i18n/translations';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { redo, undo, useHistoryStore } from '@/store/historyStore';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { LeftPane } from './LeftPane';
import { RightPane } from './RightPane';

export function AppLayout() {
  const logic = useLogicStore((s) => s.logic);
  const resetLogic = useLogicStore((s) => s.resetLogic);
  const clearEvalResult = useUiStore((s) => s.clearEvalResult);
  const clearBatch = useUiStore((s) => s.clearBatch);
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const cloudMode = useCloudStore((s) => s.mode);
  const importFn = useImportLogic();
  const t = useT();
  const [sampleGalleryOpen, setSampleGalleryOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  useAutoSave(logic, cloudMode === 'local');
  useCloudAutoSave(logic);

  const handleNew = () => {
    if (window.confirm(t.newLogicConfirm)) {
      resetLogic();
      clearEvalResult();
      clearBatch();
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Toaster position="top-right" richColors />

      <header className="h-12 border-b border-violet-200 bg-gradient-to-r from-violet-50 to-white flex items-center justify-between px-3 shrink-0 gap-4">
        <div className="flex items-center">
          <img src={logoUrl} alt="LEVERIE" height={34} className="h-[34px]" />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white hover:bg-violet-50 hover:border-violet-200 text-gray-500 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-300"
          >
            <option value="en">EN</option>
            <option value="ja">日本語</option>
          </select>
          <div className="w-px h-5 bg-gray-200" />
          <CloudMenu />
          <div className="w-px h-5 bg-gray-200" />
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
          <div className="w-px h-5 bg-gray-200" />
          <Tooltip content={t.newCreate}>
            <IconButton
              size="md"
              tone="primary"
              onClick={handleNew}
              aria-label={t.newCreate}
            >
              <FilePlus />
            </IconButton>
          </Tooltip>
          <Tooltip content={t.samples}>
            <IconButton
              size="md"
              tone="primary"
              onClick={() => setSampleGalleryOpen(true)}
              aria-label={t.samples}
            >
              <Sparkles />
            </IconButton>
          </Tooltip>
          <Tooltip content={t.batchTest}>
            <IconButton
              size="md"
              tone="primary"
              onClick={() => setBatchDialogOpen(true)}
              aria-label={t.batchTest}
            >
              <FlaskConical />
            </IconButton>
          </Tooltip>
          <Tooltip content={t.importBtn}>
            <IconButton
              size="md"
              tone="primary"
              onClick={importFn}
              aria-label={t.importBtn}
            >
              <Upload />
            </IconButton>
          </Tooltip>
          <Tooltip content={t.exportBtn}>
            <IconButton
              size="md"
              tone="primary"
              onClick={() => exportLogic(logic)}
              aria-label={t.exportBtn}
            >
              <Download />
            </IconButton>
          </Tooltip>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r bg-gray-50 overflow-hidden flex flex-col shrink-0">
          <LeftPane />
        </aside>
        <main className="flex-1 overflow-hidden bg-gray-50">
          <RightPane onOpenSampleGallery={() => setSampleGalleryOpen(true)} />
        </main>
      </div>

      <SampleGalleryDialog
        open={sampleGalleryOpen}
        onOpenChange={setSampleGalleryOpen}
      />
      <BatchDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        logic={logic}
      />
      <CloudWorkspacePicker />
    </div>
  );
}
