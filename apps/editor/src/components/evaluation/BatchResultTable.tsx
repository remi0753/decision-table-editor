import type { BatchCaseResult, Logic } from '@leverie/engine';
import { TraceView } from '@leverie/ui-runtime';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { toUiRuntimeTranslations } from '@/i18n/uiRuntime';
import { useT } from '@/i18n/useT';
import { useUiStore } from '@/store/uiStore';

interface Props {
  results: BatchCaseResult[];
  logic: Logic;
  onInspect?: () => void;
}

export function BatchResultTable({ results, logic, onInspect }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const setHighlightTarget = useUiStore((s) => s.setHighlightTarget);
  const t = useT();
  const runtimeT = useMemo(() => toUiRuntimeTranslations(t), [t]);

  const totalCount = results.length;
  const matchCount = results.filter((r) => r.result.status === 'ok').length;
  const noMatchCount = totalCount - matchCount;
  const withExpected = results.filter((r) => r.pass !== null);
  const passCount = withExpected.filter((r) => r.pass === true).length;
  const failCount = withExpected.filter((r) => r.pass === false).length;

  const toggle = (i: number) =>
    setExpandedIndex((prev) => (prev === i ? null : i));

  const handleInspect = (r: BatchCaseResult) => {
    const lastStep = r.result.trace[r.result.trace.length - 1];
    const targetTableId =
      r.result.status === 'no_match'
        ? r.result.tableId
        : (lastStep?.tableId ?? null);
    if (!targetTableId) return;
    setSelectedTable(targetTableId);
    setHighlightTarget({
      tableId: targetTableId,
      rowId: lastStep?.matchedRowId ?? undefined,
    });
    onInspect?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-600">{t.totalCases(totalCount)}</span>
        <span className="text-green-600">{t.matchedCases(matchCount)}</span>
        {noMatchCount > 0 && (
          <span className="text-red-500">{t.noMatchCases(noMatchCount)}</span>
        )}
        {withExpected.length > 0 && (
          <>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              {t.withExpected(withExpected.length)}
            </span>
            <span className="text-green-600">Pass {passCount}</span>
            {failCount > 0 && (
              <span className="text-red-500">Fail {failCount}</span>
            )}
          </>
        )}
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="px-2 py-1.5 text-left w-6"></th>
              <th className="px-2 py-1.5 text-left w-8">#</th>
              <th className="px-2 py-1.5 text-left">{t.caseName}</th>
              <th className="px-2 py-1.5 text-left">{t.resultCol}</th>
              <th className="px-2 py-1.5 text-left">{t.expectedCol}</th>
              <th className="px-2 py-1.5 text-right w-20" />
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const isFail = r.pass === false || r.result.status === 'no_match';
              return (
                <Fragment key={r.batchCase.name}>
                  <tr
                    onClick={() => toggle(i)}
                    className={`cursor-pointer hover:bg-gray-50 border-t ${
                      isFail ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <td className="px-2 py-1.5 text-gray-400">
                      {expandedIndex === i ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-2 py-1.5 text-gray-800">
                      {r.batchCase.name}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.result.status === 'ok' ? (
                        <span className="text-green-600">
                          {t.matchedResult}
                        </span>
                      ) : (
                        <span className="text-red-500">{t.noMatchResult}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.pass === null ? (
                        <span className="text-gray-400">-</span>
                      ) : r.pass ? (
                        <span className="text-green-600">✓ Pass</span>
                      ) : (
                        <span className="text-red-500">✗ Fail</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Tooltip content={t.inspectInEditorTooltip}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspect(r);
                          }}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                            isFail
                              ? 'border-red-200 text-red-600 hover:bg-red-100'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                          }`}
                          aria-label={t.inspectInEditor}
                        >
                          <Pencil size={11} />
                          {t.inspectInEditor}
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                  {expandedIndex === i && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50 border-t">
                        <div className="text-xs text-gray-500 mb-2">
                          {isFail
                            ? r.result.status === 'no_match'
                              ? t.inspectInEditorFailHint
                              : t.inspectInEditorPassHint
                            : t.inspectInEditorPassHint}
                        </div>
                        <TraceView
                          result={r.result}
                          logic={logic}
                          translations={runtimeT}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{t.clickForTrace}</p>
    </div>
  );
}
