import { Download, FilePlus, Upload } from 'lucide-react';
import { Toaster } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { exportLogic, useImportLogic } from '@/hooks/useImportExport';
import { useAutoSave } from '@/hooks/useLocalStorage';
import type { Lang } from '@/i18n/translations';
import { useT } from '@/i18n/useT';
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
  const importFn = useImportLogic();
  const t = useT();

  useAutoSave(logic);

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

      <header className="h-20 border-b border-violet-200 bg-gradient-to-r from-violet-50 to-white flex items-center justify-between px-5 shrink-0 gap-4">
        <div className="flex items-center">
          <img src={logoUrl} alt="LEVERIE" height={40} />
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
          <button
            type="button"
            onClick={handleNew}
            className="flex items-center gap-1 text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-violet-50 hover:border-violet-200 text-gray-600"
          >
            <FilePlus size={14} /> {t.newCreate}
          </button>
          <button
            type="button"
            onClick={importFn}
            className="flex items-center gap-1 text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-violet-50 hover:border-violet-200 text-gray-600"
          >
            <Upload size={14} /> {t.importBtn}
          </button>
          <button
            type="button"
            onClick={() => exportLogic(logic)}
            className="flex items-center gap-1 text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-violet-50 hover:border-violet-200 text-gray-600"
          >
            <Download size={14} /> {t.exportBtn}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r bg-gray-50 overflow-hidden flex flex-col shrink-0">
          <LeftPane />
        </aside>
        <main className="flex-1 overflow-hidden bg-gray-50">
          <RightPane />
        </main>
      </div>
    </div>
  );
}
