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
        <span className="text-fg-muted">{t.totalCases(totalCount)}</span>
        <span className="text-success-fg">{t.matchedCases(matchCount)}</span>
        {noMatchCount > 0 && (
          <span className="text-danger-fg">{t.noMatchCases(noMatchCount)}</span>
        )}
        {withExpected.length > 0 && (
          <>
            <span className="text-fg-faint">|</span>
            <span className="text-fg-muted">
              {t.withExpected(withExpected.length)}
            </span>
            <span className="text-success-fg">Pass {passCount}</span>
            {failCount > 0 && (
              <span className="text-danger-fg">Fail {failCount}</span>
            )}
          </>
        )}
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-muted text-fg-subtle text-xs">
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
                    className={`cursor-pointer hover:bg-surface-muted border-t ${
                      isFail ? 'bg-danger-bg/40' : ''
                    }`}
                  >
                    <td className="px-2 py-1.5 text-fg-faint">
                      {expandedIndex === i ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-fg-faint">{i + 1}</td>
                    <td className="px-2 py-1.5 text-fg-secondary">
                      {r.batchCase.name}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.result.status === 'ok' ? (
                        <span className="text-success-fg">
                          {t.matchedResult}
                        </span>
                      ) : (
                        <span className="text-danger-fg">
                          {t.noMatchResult}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.pass === null ? (
                        <span className="text-fg-faint">-</span>
                      ) : r.pass ? (
                        <span className="text-success-fg">✓ Pass</span>
                      ) : (
                        <span className="text-danger-fg">✗ Fail</span>
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
                              ? 'border-danger-border text-danger-fg hover:bg-danger-bg'
                              : 'border-line text-fg-subtle hover:bg-surface-subtle'
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
                      <td
                        colSpan={6}
                        className="px-4 py-3 bg-surface-muted border-t"
                      >
                        <div className="text-xs text-fg-subtle mb-2">
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
      <p className="text-xs text-fg-faint">{t.clickForTrace}</p>
    </div>
  );
}
