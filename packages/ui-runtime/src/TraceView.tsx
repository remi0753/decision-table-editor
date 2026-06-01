import type { EvalResult, Logic, TraceStep } from '@leverie/engine';
import {
  defaultTranslations,
  type UiRuntimeTranslations,
} from './translations.js';

interface TraceViewProps {
  result: EvalResult;
  logic: Logic;
  translations?: UiRuntimeTranslations;
}

function TraceStepView({
  step,
  logic,
  t,
}: {
  step: TraceStep;
  logic: Logic;
  t: UiRuntimeTranslations;
}) {
  const table = logic.tables[step.tableId];
  if (!table) return null;

  const getRowNumber = (rowId: string) =>
    table.rows.findIndex((r) => r.id === rowId) + 1;

  return (
    <div className="border rounded p-3 mb-2 bg-surface">
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
          <div key={sr.rowId} className="text-fg-subtle text-xs pl-4 py-0.5">
            {rowNum}:{' '}
            {failedField
              ? t.conditionNotMet(failedField.name)
              : t.conditionNotMetGeneral}
          </div>
        );
      })}
      {step.matchedRowId && (
        <div className="text-success-fg text-xs pl-4 py-0.5">
          {t.rowMatched(getRowNumber(step.matchedRowId))}
        </div>
      )}
      {!step.matchedRowId && step.skippedRows.length === table.rows.length && (
        <div className="text-danger-fg text-xs pl-4 py-0.5">
          {t.noMatchInTable}
        </div>
      )}
    </div>
  );
}

export function TraceView({ result, logic, translations }: TraceViewProps) {
  const t = translations ?? defaultTranslations.en;

  return (
    <div className="space-y-1">
      {result.trace.map((step) => (
        <TraceStepView
          key={`${step.tableId}-${step.depth}`}
          step={step}
          logic={logic}
          t={t}
        />
      ))}

      {result.status === 'ok' && (
        <div className="bg-success-bg border border-success-border rounded p-3">
          <div className="text-success-fg font-medium text-sm mb-1">
            {t.evalSuccess}
          </div>
          {Object.entries(result.outputs).map(([colId, val]) => {
            const colName =
              Object.values(logic.tables)
                .flatMap((tb) => tb.outputCols)
                .find((oc) => oc.id === colId)?.name ?? colId;
            return (
              <div key={colId} className="text-sm">
                <span className="text-fg-subtle">{colName}: </span>
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
            <div className="bg-danger-bg border border-danger-border rounded p-3">
              <div className="text-danger-fg font-medium text-sm mb-1">
                {t.evalNoMatch}
              </div>
              <p className="text-sm text-danger-fg">
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
