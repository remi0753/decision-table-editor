import { EvaluationPanel } from '@/components/evaluation/EvaluationPanel';
import { DecisionTable } from '@/components/table/DecisionTable';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

export function RightPane() {
  const selectedTableId = useUiStore((s) => s.selectedTableId);
  const logic = useLogicStore((s) => s.logic);
  const t = useT();

  const tableId = selectedTableId ?? logic.entryTableId;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {tableId && logic.tables[tableId] ? (
          <div className="border rounded-lg bg-white overflow-hidden">
            <DecisionTable tableId={tableId} />
          </div>
        ) : (
          <div className="text-gray-400 text-sm p-4">{t.selectTable}</div>
        )}
      </div>
      <EvaluationPanel />
    </div>
  );
}
