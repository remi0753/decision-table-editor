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
import { PublishDiffHeatmap } from './PublishDiffHeatmap';

type Props = {
  logicId: string;
  draftLogic: Logic;
  hasPreviousVersion: boolean;
  onClose: () => void;
  onPublish: () => Promise<void>;
};

type RuleDiffTab = 'changed' | 'added' | 'removed' | 'all';
type ViewMode = 'map' | 'detail';

function changeTone(kind: RuleDiff['kind']) {
  if (kind === 'added')
    return 'border-success-border bg-success-bg text-success-fg';
  if (kind === 'removed')
    return 'border-danger-border bg-danger-bg text-danger-fg';
  return 'border-line bg-surface-muted text-fg-muted';
}

function ChangeRows({
  rows,
  beforeLabel,
  afterLabel,
}: {
  rows: CellDiff[];
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="divide-y divide-line-subtle rounded border border-line bg-surface">
      {rows.map((row) => (
        <div
          key={`${row.label}:${row.before}:${row.after}`}
          className="grid gap-2 px-3 py-2.5 text-xs sm:grid-cols-[140px_1fr]"
        >
          <div className="font-medium text-fg-secondary">{row.label}</div>
          <div className="grid min-w-0 gap-1.5 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <div className="min-w-0 rounded border border-danger-border bg-danger-bg px-2 py-1 text-fg-secondary">
              <span className="mr-1 text-[10px] font-medium uppercase text-danger-fg">
                {beforeLabel}
              </span>
              <span className="break-words">{row.before}</span>
            </div>
            <div className="hidden px-1 pt-1 text-fg-faint sm:block">→</div>
            <div className="min-w-0 rounded border border-success-border bg-success-bg px-2 py-1 text-fg">
              <span className="mr-1 text-[10px] font-medium uppercase text-success-fg">
                {afterLabel}
              </span>
              <span className="break-words font-medium">{row.after}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChangeSection({
  title,
  rows,
  beforeLabel,
  afterLabel,
}: {
  title: string;
  rows: CellDiff[];
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="rounded border border-line bg-surface-muted p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-fg-secondary">{title}</div>
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle">
          {rows.length}
        </span>
      </div>
      <ChangeRows
        rows={rows}
        beforeLabel={beforeLabel}
        afterLabel={afterLabel}
      />
    </div>
  );
}

function StaticRows({ rows }: { rows: CellDiff[] }) {
  return (
    <div className="divide-y divide-line-subtle rounded border border-line">
      {rows.map((row) => (
        <div
          key={`${row.label}:${row.after}`}
          className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[150px_1fr]"
        >
          <div className="font-medium text-fg-secondary">{row.label}</div>
          <div className="min-w-0 break-words text-fg">{row.after}</div>
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
    <section
      id={`rule-${diff.id}`}
      className="rounded border border-line bg-surface"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-medium text-fg-muted">
            {t.publishReviewRuleLabel(diff.tableName, rowNumber)}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${changeTone(diff.kind)}`}
        >
          {kindLabel}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {diff.kind === 'added' ? (
          <>
            <div>
              <div className="mb-2 text-xs font-semibold text-fg-subtle">
                {t.publishReviewConditions}
              </div>
              <StaticRows rows={diff.afterConditions} />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-fg-subtle">
                {t.publishReviewResults}
              </div>
              <StaticRows rows={diff.afterResults} />
            </div>
          </>
        ) : null}

        {diff.kind === 'removed' ? (
          <>
            <div>
              <div className="mb-2 text-xs font-semibold text-fg-subtle">
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
              <div className="mb-2 text-xs font-semibold text-fg-subtle">
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
              <div className="rounded border border-warning-border bg-warning-bg px-3 py-2 text-xs font-medium text-warning-fg">
                {t.publishReviewPriorityChanged(
                  diff.priorityChange.before,
                  diff.priorityChange.after,
                )}
              </div>
            ) : null}
            {diff.conditionChanges.length > 0 ? (
              <ChangeSection
                title={t.publishReviewConditionChanges}
                rows={diff.conditionChanges}
                beforeLabel={t.publishReviewBefore}
                afterLabel={t.publishReviewAfter}
              />
            ) : null}
            {diff.resultChanges.length > 0 ? (
              <ChangeSection
                title={t.publishReviewResultChanges}
                rows={diff.resultChanges}
                beforeLabel={t.publishReviewBefore}
                afterLabel={t.publishReviewAfter}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function ruleTabCount(summary: LogicDiffSummary, tab: RuleDiffTab) {
  if (tab === 'changed') return summary.changedRules;
  if (tab === 'added') return summary.addedRules;
  if (tab === 'removed') return summary.removedRules;
  return summary.ruleDiffs.length;
}

function ruleTabLabel(tab: RuleDiffTab, t: ReturnType<typeof useT>) {
  if (tab === 'changed') return t.publishReviewChanged;
  if (tab === 'added') return t.publishReviewAdded;
  if (tab === 'removed') return t.publishReviewRemoved;
  return t.publishReviewAllRules;
}

function filteredRuleDiffs(summary: LogicDiffSummary, tab: RuleDiffTab) {
  if (tab === 'all') return summary.ruleDiffs;
  return summary.ruleDiffs.filter((diff) => diff.kind === tab);
}

function ChangedTabMeta({ summary }: { summary: LogicDiffSummary }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2 border-b border-line-subtle bg-surface-muted px-4 py-2">
      {[
        [t.publishReviewConditionCellChanges, summary.conditionCellChanges],
        [t.publishReviewResultCellChanges, summary.resultCellChanges],
        [t.publishReviewPriorityChanges, summary.priorityChanges],
      ].map(([label, count]) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-1 text-[11px] text-fg-muted"
        >
          <span>{label}</span>
          <span className="font-semibold text-fg">{count}</span>
        </span>
      ))}
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
  const [activeTab, setActiveTab] = useState<RuleDiffTab>('changed');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [focusRuleId, setFocusRuleId] = useState<string | null>(null);

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
  const visibleRuleDiffs = useMemo(
    () => (summary ? filteredRuleDiffs(summary, activeTab) : []),
    [activeTab, summary],
  );

  useEffect(() => {
    if (!summary) return;
    const nextTab =
      summary.changedRules > 0
        ? 'changed'
        : summary.addedRules > 0
          ? 'added'
          : summary.removedRules > 0
            ? 'removed'
            : 'all';
    setActiveTab(nextTab);
  }, [summary]);

  const handleSelectRule = (ruleId: string) => {
    setViewMode('detail');
    setActiveTab('all');
    setFocusRuleId(ruleId);
  };

  useEffect(() => {
    if (viewMode !== 'detail' || !focusRuleId) return;
    const node = document.getElementById(`rule-${focusRuleId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('ring-2', 'ring-brand-ring');
    const timer = window.setTimeout(() => {
      node.classList.remove('ring-2', 'ring-brand-ring');
      setFocusRuleId(null);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [viewMode, focusRuleId]);

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 p-4">
      <div className="flex h-[min(760px,calc(100vh-2rem))] w-full max-w-3xl flex-col rounded-md border border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line-subtle px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg">
              {t.publishReviewTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-surface-muted p-4">
          {!hasPreviousVersion ? (
            <div className="rounded border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">
                {t.publishReviewFirstPublishTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-fg-muted">
                {t.publishReviewFirstPublishDescription}
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 rounded border border-line bg-surface p-4 text-sm text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.publishReviewLoading}
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded border border-danger-border bg-danger-bg p-4 text-sm text-danger-fg">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : summary ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col rounded border border-line bg-surface">
                <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-fg">
                    {t.publishReviewRuleChanges}
                  </h3>
                  <div className="inline-flex shrink-0 rounded border border-line p-0.5">
                    {(['map', 'detail'] satisfies ViewMode[]).map((mode) => {
                      const selected = viewMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setViewMode(mode)}
                          className={`inline-flex h-7 items-center rounded px-3 text-xs font-medium ${
                            selected
                              ? 'bg-brand text-white'
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          {mode === 'map'
                            ? t.publishReviewViewMap
                            : t.publishReviewViewDetail}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {viewMode === 'map' ? (
                  <PublishDiffHeatmap
                    grids={summary.tableGrids}
                    onSelectRule={handleSelectRule}
                  />
                ) : (
                  <>
                    <div className="flex gap-1 overflow-x-auto border-b border-line-subtle px-4">
                      {(
                        [
                          'changed',
                          'added',
                          'removed',
                          'all',
                        ] satisfies RuleDiffTab[]
                      ).map((tab) => {
                        const selected = activeTab === tab;
                        const count = ruleTabCount(summary, tab);
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-medium ${
                              selected
                                ? 'border-brand-border-strong text-brand-fg'
                                : 'border-transparent text-fg-subtle hover:border-line hover:text-fg-secondary'
                            }`}
                          >
                            <span>{ruleTabLabel(tab, t)}</span>
                            <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-fg-muted">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {activeTab === 'changed' && hasRuleChanges ? (
                      <ChangedTabMeta summary={summary} />
                    ) : null}

                    {hasRuleChanges ? (
                      <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        {visibleRuleDiffs.length > 0 ? (
                          <div className="space-y-3">
                            {visibleRuleDiffs.map((diff) => (
                              <RuleDiffCard key={diff.id} diff={diff} />
                            ))}
                          </div>
                        ) : (
                          <div className="rounded border border-line bg-surface-muted p-4 text-sm text-fg-muted">
                            {t.publishReviewNoChanges}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3">
                        <div className="rounded border border-line bg-surface-muted p-4 text-sm text-fg-muted">
                          {t.publishReviewNoChanges}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line-subtle px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded border border-line px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
          >
            {t.publishReviewBackToDraft}
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={loading || publishing}
            className="inline-flex h-9 items-center justify-center gap-2 rounded bg-success px-3 text-sm font-medium text-white hover:bg-success disabled:opacity-50"
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
