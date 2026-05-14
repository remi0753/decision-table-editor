import { useUiStore } from '@/store/uiStore';
import { useLogicStore } from '@/store/logicStore';
import { FieldDefPanel } from '@/components/fields/FieldDefPanel';
import { DecisionTable } from '@/components/table/DecisionTable';
import { EvaluationPanel } from '@/components/evaluation/EvaluationPanel';
import { useT } from '@/i18n/useT';

export function RightPane() {
  const selectedTableId = useUiStore(s => s.selectedTableId);
  const logic = useLogicStore(s => s.logic);
  const t = useT();

  const tableId = selectedTableId ?? logic.entryTableId;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-0">
      <FieldDefPanel />
      {tableId && logic.tables[tableId] ? (
        <div className="border rounded-lg bg-white overflow-hidden">
          <DecisionTable tableId={tableId} />
        </div>
      ) : (
        <div className="text-gray-400 text-sm p-4">{t.selectTable}</div>
      )}
      <EvaluationPanel />
    </div>
  );
}
