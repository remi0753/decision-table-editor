import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { loadFromStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';

export default function App() {
  const importLogic = useLogicStore(s => s.importLogic);
  const logic = useLogicStore(s => s.logic);
  const setSelectedTable = useUiStore(s => s.setSelectedTable);

  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      importLogic(saved);
    } else {
      toast.info('新しいロジックを作成しました。');
    }
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedTable(logic.entryTableId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AppLayout />;
}
