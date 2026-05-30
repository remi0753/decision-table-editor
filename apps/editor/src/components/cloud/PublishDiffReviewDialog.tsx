import type { Logic } from '@leverie/engine';
import { AlertCircle, Loader2, Rocket, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n/useT';
import { CloudApiError, getLogicDiff } from '@/lib/cloudApi';
import {
  buildLogicDiffSummary,
  type CellDiff,
  type LogicDiffSummary,
  type RuleDiff,
} from '@/lib/logicDiffSummary';

type Props = {
  logicId: string;
  draftLogic: Logic;
  hasPreviousVersion: boolean;
  onClose: () => void;
  onPublish: () => Promise<void>;
};

function countLabel(label: string, value: number) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-[11px] font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function changeTone(kind: RuleDiff['kind']) {
  if (kind === 'added')
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (kind === 'removed') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function DiffRows({
  rows,
  beforeLabel,
  afterLabel,
}: {
  rows: CellDiff[];
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="divide-y divide-gray-100 rounded border border-gray-200">
      {rows.map((row) => (
        <div
          key={`${row.label}:${row.before}:${row.after}`}
          className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[150px_1fr_1fr]"
        >
          <div className="font-medium text-gray-700">{row.label}</div>
          <div className="min-w-0 text-gray-600">
            <span className="mr-1 text-gray-400">{beforeLabel}</span>
            <span className="break-words">{row.before}</span>
          </div>
          <div className="min-w-0 text-gray-900">
            <span className="mr-1 text-gray-400">{afterLabel}</span>
            <span className="break-words font-medium">{row.after}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StaticRows({ rows }: { rows: CellDiff[] }) {
  return (
    <div className="divide-y divide-gray-100 rounded border border-gray-200">
      {rows.map((row) => (
        <div
          key={`${row.label}:${row.after}`}
          className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[150px_1fr]"
        >
          <div className="font-medium text-gray-700">{row.label}</div>
          <div className="min-w-0 break-words text-gray-900">{row.after}</div>
        </div>
      ))}
    </div>
  );
}

function RuleDiffCard({ diff }: { diff: RuleDiff }) {
  const t = useT();
  const rowNumber = diff.afterRowNumber ?? diff.beforeRowNumber;
  const kindLabel =
    diff.kind === 'added'
      ? t.publishReviewAdded
      : diff.kind === 'removed'
        ? t.publishReviewRemoved
        : t.publishReviewChanged;

  return (
    <section className="rounded border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {t.publishReviewRuleLabel(diff.tableName, diff.rowId, rowNumber)}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">{diff.rowId}</p>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${changeTone(diff.kind)}`}
        >
          {kindLabel}
        </span>
      </div>

      <div className="space-y-4 p-4">
        {diff.kind === 'added' ? (
          <>
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">
                {t.publishReviewConditions}
              </div>
              <StaticRows rows={diff.afterConditions} />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">
                {t.publishReviewResults}
              </div>
              <StaticRows rows={diff.afterResults} />
            </div>
          </>
        ) : null}

        {diff.kind === 'removed' ? (
          <>
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">
                {t.publishReviewConditions}
              </div>
              <StaticRows
                rows={diff.beforeConditions.map((row) => ({
                  ...row,
                  after: row.after,
                }))}
              />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">
                {t.publishReviewResults}
              </div>
              <StaticRows
                rows={diff.beforeResults.map((row) => ({
                  ...row,
                  after: row.after,
                }))}
              />
            </div>
          </>
        ) : null}

        {diff.kind === 'changed' ? (
          <>
            {diff.priorityChange ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {t.publishReviewPriorityChanged(
                  diff.priorityChange.before,
                  diff.priorityChange.after,
                )}
              </div>
            ) : null}
            {diff.conditionChanges.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-500">
                  {t.publishReviewConditionChanges}
                </div>
                <DiffRows
                  rows={diff.conditionChanges}
                  beforeLabel={t.publishReviewBefore}
                  afterLabel={t.publishReviewAfter}
                />
              </div>
            ) : null}
            {diff.resultChanges.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-500">
                  {t.publishReviewResultChanges}
                </div>
                <DiffRows
                  rows={diff.resultChanges}
                  beforeLabel={t.publishReviewBefore}
                  afterLabel={t.publishReviewAfter}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function SummaryPanel({ summary }: { summary: LogicDiffSummary }) {
  const t = useT();
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {t.publishReviewSummary}
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {countLabel(t.publishReviewAddedRules, summary.addedRules)}
        {countLabel(t.publishReviewChangedRules, summary.changedRules)}
        {countLabel(t.publishReviewRemovedRules, summary.removedRules)}
        {countLabel(
          t.publishReviewConditionCellChanges,
          summary.conditionCellChanges,
        )}
        {countLabel(
          t.publishReviewResultCellChanges,
          summary.resultCellChanges,
        )}
        {countLabel(t.publishReviewPriorityChanges, summary.priorityChanges)}
      </div>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function PublishDiffReviewDialog({
  logicId,
  draftLogic,
  hasPreviousVersion,
  onClose,
  onPublish,
}: Props) {
  const t = useT();
  const [loading, setLoading] = useState(hasPreviousVersion);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<LogicDiffSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasPreviousVersion) return;

    setLoading(true);
    setError('');
    getLogicDiff(logicId)
      .then((result) => {
        if (cancelled) return;
        setSummary(
          buildLogicDiffSummary(result.from.data, draftLogic, {
            operatorLabels: t.operatorLabels,
            wildcardLabel: t.wildcard,
            unsetLabel: t.unset,
            terminalLabel: t.terminalConclusion,
            continueLabel: t.continueRef,
            tableNotFoundLabel: t.tableNotFound,
          }),
        );
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(errorMessage(nextError, t.publishReviewLoadFailed));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [draftLogic, hasPreviousVersion, logicId, t]);

  const hasRuleChanges = useMemo(
    () => (summary?.ruleDiffs.length ?? 0) > 0,
    [summary],
  );

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish();
      onClose();
    } catch (nextError) {
      toast.error(errorMessage(nextError, t.publishReviewLoadFailed));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/30 p-4">
      <div className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-3xl flex-col rounded-md border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              {t.publishReviewTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4">
          {!hasPreviousVersion ? (
            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {t.publishReviewFirstPublishTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {t.publishReviewFirstPublishDescription}
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.publishReviewLoading}
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              <SummaryPanel summary={summary} />

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  {t.publishReviewRuleChanges}
                </h3>
                {hasRuleChanges ? (
                  <div className="space-y-3">
                    {summary.ruleDiffs.map((diff) => (
                      <RuleDiffCard key={diff.id} diff={diff} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
                    {t.publishReviewNoChanges}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t.publishReviewBackToDraft}
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={loading || publishing}
            className="inline-flex h-9 items-center justify-center gap-2 rounded bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {error
              ? t.publishReviewPublishAnyway
              : t.publishReviewPublishConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
