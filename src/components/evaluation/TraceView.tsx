import { useT } from '@/i18n/useT';
import type { EvalResult, Logic, TraceStep } from '@/types/logic';

interface Props {
  result: EvalResult;
  logic: Logic;
}

function TraceStepView({ step, logic }: { step: TraceStep; logic: Logic }) {
  const t = useT();
  const table = logic.tables[step.tableId];
  if (!table) return null;

  const getRowNumber = (rowId: string) =>
    table.rows.findIndex((r) => r.id === rowId) + 1;

  return (
    <div className="border rounded p-3 mb-2 bg-white">
      <div className="font-medium text-sm mb-1">
        {t.traceStepTitle(step.depth + 1, step.tableName)}
      </div>
      {step.skippedRows.map((sr) => {
        const rowNum = getRowNumber(sr.rowId);
        const failedCol = table.cols.find((c) => c.id === sr.failedColId);
        const failedField = failedCol?.fieldId
          ? logic.fieldDefs[failedCol.fieldId]
          : null;
        return (
          <div key={sr.rowId} className="text-gray-500 text-xs pl-4 py-0.5">
            {rowNum}:{' '}
            {failedField
              ? t.conditionNotMet(failedField.name)
              : t.conditionNotMetGeneral}
          </div>
        );
      })}
      {step.matchedRowId && (
        <div className="text-green-600 text-xs pl-4 py-0.5">
          {t.rowMatched(getRowNumber(step.matchedRowId))}
        </div>
      )}
      {!step.matchedRowId && step.skippedRows.length === table.rows.length && (
        <div className="text-red-500 text-xs pl-4 py-0.5">
          {t.noMatchInTable}
        </div>
      )}
    </div>
  );
}

export function TraceView({ result, logic }: Props) {
  const t = useT();

  return (
    <div className="space-y-1">
      {result.trace.map((step) => (
        <TraceStepView
          key={`${step.tableId}-${step.depth}`}
          step={step}
          logic={logic}
        />
      ))}

      {result.status === 'ok' && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="text-green-700 font-medium text-sm mb-1">
            {t.evalSuccess}
          </div>
          {Object.entries(result.outputs).map(([colId, val]) => {
            const colName =
              Object.values(logic.tables)
                .flatMap((tb) => tb.outputCols)
                .find((oc) => oc.id === colId)?.name ?? colId;
            return (
              <div key={colId} className="text-sm">
                <span className="text-gray-500">{colName}: </span>
                <span className="font-medium">{val}</span>
              </div>
            );
          })}
        </div>
      )}

      {result.status === 'no_match' &&
        (() => {
          const lastStep = result.trace[result.trace.length - 1];
          const isEntry = !lastStep || lastStep.depth === 0;
          return (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="text-red-700 font-medium text-sm mb-1">
                {t.evalNoMatch}
              </div>
              <p className="text-sm text-red-600">
                {isEntry
                  ? t.noMatchAny
                  : t.noMatchInRef(
                      logic.tables[result.tableId]?.name ?? result.tableId,
                    )}
              </p>
            </div>
          );
        })()}
    </div>
  );
}
