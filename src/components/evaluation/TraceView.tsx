import { type EvalResult, type TraceStep, type Logic } from '@/types/logic';
import { formatCellSummary } from '@/components/table/cellUtils';

interface Props {
  result: EvalResult;
  logic: Logic;
}

function TraceStepView({ step, logic }: { step: TraceStep; logic: Logic }) {
  const table = logic.tables[step.tableId];
  if (!table) return null;

  const getRowNumber = (rowId: string) => table.rows.findIndex(r => r.id === rowId) + 1;

  return (
    <div className="border rounded p-3 mb-2 bg-white">
      <div className="font-medium text-sm mb-1">
        [ステップ{step.depth + 1}] テーブル「{step.tableName}」を評価
      </div>
      {step.skippedRows.map(sr => {
        const rowNum = getRowNumber(sr.rowId);
        const failedCol = table.cols.find(c => c.id === sr.failedColId);
        const failedField = failedCol?.fieldId ? logic.fieldDefs[failedCol.fieldId] : null;
        return (
          <div key={sr.rowId} className="text-gray-500 text-xs pl-4 py-0.5">
            行{rowNum}: {failedField ? `${failedField.name} の条件を満たさず` : '条件を満たさず'} → スキップ
          </div>
        );
      })}
      {step.matchedRowId && (
        <div className="text-green-600 text-xs pl-4 py-0.5">
          行{getRowNumber(step.matchedRowId)}: → マッチ ✓
        </div>
      )}
      {!step.matchedRowId && step.skippedRows.length === table.rows.length && (
        <div className="text-red-500 text-xs pl-4 py-0.5">
          マッチする行がありませんでした。
        </div>
      )}
    </div>
  );
}

export function TraceView({ result, logic }: Props) {
  return (
    <div className="space-y-1">
      {result.trace.map((step, i) => (
        <TraceStepView key={`${step.tableId}-${i}`} step={step} logic={logic} />
      ))}

      {result.status === 'ok' && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="text-green-700 font-medium text-sm mb-1">✓ 評価結果</div>
          {Object.entries(result.outputs).map(([colId, val]) => {
            const colName = Object.values(logic.tables)
              .flatMap(t => t.outputCols)
              .find(oc => oc.id === colId)?.name ?? colId;
            return (
              <div key={colId} className="text-sm">
                <span className="text-gray-500">{colName}: </span>
                <span className="font-medium">{val}</span>
              </div>
            );
          })}
        </div>
      )}

      {result.status === 'no_match' && (() => {
        const lastStep = result.trace[result.trace.length - 1];
        const isEntry = !lastStep || lastStep.depth === 0;
        return (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="text-red-700 font-medium text-sm mb-1">✗ マッチなし</div>
            <p className="text-sm text-red-600">
              {isEntry
                ? 'どのルールにも一致しませんでした。条件を確認してください。'
                : `継続参照先のテーブル「${logic.tables[result.tableId]?.name ?? result.tableId}」でマッチするルールがありませんでした。`}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
