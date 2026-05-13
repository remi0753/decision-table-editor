import { Download, Upload, FilePlus } from 'lucide-react';
import { Toaster } from 'sonner';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { useAutoSave } from '@/hooks/useLocalStorage';
import { exportLogic, useImportLogic } from '@/hooks/useImportExport';
import { LeftPane } from './LeftPane';
import { RightPane } from './RightPane';

export function AppLayout() {
  const logic = useLogicStore(s => s.logic);
  const resetLogic = useLogicStore(s => s.resetLogic);
  const clearEvalResult = useUiStore(s => s.clearEvalResult);
  const clearBatch = useUiStore(s => s.clearBatch);
  const importFn = useImportLogic();

  useAutoSave(logic);

  const handleNew = () => {
    if (window.confirm('現在のロジックを閉じて新しいロジックを作成しますか？\n現在のロジックはブラウザに保存されています。')) {
      resetLogic();
      clearEvalResult();
      clearBatch();
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Toaster position="top-right" richColors />

      <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 text-base">📋</span>
          <span className="font-semibold text-gray-800 text-sm tracking-tight">LEVERIE</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNew}
            className="flex items-center gap-1 text-sm border rounded px-3 py-1.5 hover:bg-gray-50 text-gray-600"
          >
            <FilePlus size={14} /> 新規作成
          </button>
          <button
            onClick={importFn}
            className="flex items-center gap-1 text-sm border rounded px-3 py-1.5 hover:bg-gray-50 text-gray-600"
          >
            <Upload size={14} /> インポート
          </button>
          <button
            onClick={() => exportLogic(logic)}
            className="flex items-center gap-1 text-sm border rounded px-3 py-1.5 hover:bg-gray-50 text-gray-600"
          >
            <Download size={14} /> エクスポート
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
