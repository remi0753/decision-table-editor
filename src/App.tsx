import { useEffect } from 'react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { loadFromStorage } from '@/hooks/useLocalStorage';
import { useUndoRedoShortcuts } from '@/hooks/useUndoRedoShortcuts';
import { useT } from '@/i18n/useT';
import { clearHistory } from '@/store/historyStore';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

export default function App() {
  const importLogic = useLogicStore((s) => s.importLogic);
  const logic = useLogicStore((s) => s.logic);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const t = useT();

  useUndoRedoShortcuts();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      importLogic(saved);
    } else {
      toast.info(t.newLogicCreated);
    }
    clearHistory();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    setSelectedTable(logic.entryTableId);
  }, []);

  return <AppLayout />;
}
