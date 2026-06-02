import { EvaluationPanel } from '@/components/evaluation/EvaluationPanel';
import { LogicInsightBar } from '@/components/logic/LogicInsightBar';
import { DecisionTable } from '@/components/table/DecisionTable';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

interface Props {
  onOpenSampleGallery: () => void;
}

export function RightPane({ onOpenSampleGallery }: Props) {
  const selectedTableId = useUiStore((s) => s.selectedTableId);
  const logic = useLogicStore((s) => s.logic);
  const t = useT();

  const tableId = selectedTableId ?? logic.entryTableId;

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tableId && logic.tables[tableId] ? (
            <>
              <LogicInsightBar />
              <DecisionTable
                tableId={tableId}
                onOpenSampleGallery={onOpenSampleGallery}
              />
            </>
          ) : (
            <div className="text-fg-faint text-sm p-4">{t.selectTable}</div>
          )}
        </div>
      </div>
      <EvaluationPanel />
    </div>
  );
}
