import { Download, Upload } from 'lucide-react';
import { Toaster } from 'sonner';
import { useLogicStore } from '@/store/logicStore';
import { useAutoSave } from '@/hooks/useLocalStorage';
import { exportLogic, useImportLogic } from '@/hooks/useImportExport';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { LeftPane } from './LeftPane';
import { RightPane } from './RightPane';

export function AppLayout() {
  const logic = useLogicStore(s => s.logic);
  const setLogicName = useLogicStore(s => s.setLogicName);
  const importFn = useImportLogic();

  useAutoSave(logic);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Toaster position="top-right" richColors />

      <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">📋</span>
          <InlineEdit
            value={logic.name}
            onSave={setLogicName}
            className="font-semibold text-gray-800"
            inputClassName="text-base"
            placeholder="ロジック名"
          />
        </div>
        <div className="flex items-center gap-2">
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
