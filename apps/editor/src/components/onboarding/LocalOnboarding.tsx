import { CheckCircle2, Circle, FilePlus2, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { hasEditableContent, useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

type TourStepId =
  | 'field'
  | 'condition'
  | 'row'
  | 'conditionCell'
  | 'conclusion'
  | 'evaluate';

interface TourStep {
  id: TourStepId;
  label: string;
  hint: string;
  done: boolean;
}

interface Props {
  enabled: boolean;
}

export function LocalOnboarding({ enabled }: Props) {
  const logic = useLogicStore((s) => s.logic);
  const selectedTableId = useUiStore((s) => s.selectedTableId);
  const evalDrawerOpen = useUiStore((s) => s.evalDrawerOpen);
  const evalResult = useUiStore((s) => s.evalResult);
  const t = useT();

  const tableId = selectedTableId ?? logic.entryTableId;
  const table = logic.tables[tableId];
  const isEmptyLogic = !hasEditableContent(logic);
  const [choiceOpen, setChoiceOpen] = useState(enabled && isEmptyLogic);
  const [choiceDismissed, setChoiceDismissed] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  useEffect(() => {
    if (!enabled || choiceDismissed || tourActive || !isEmptyLogic) return;
    setChoiceOpen(true);
  }, [enabled, choiceDismissed, tourActive, isEmptyLogic]);

  const steps = useMemo<TourStep[]>(() => {
    const fields = Object.keys(logic.fieldDefs);
    const hasField = fields.length > 0;
    const hasAssignedConditionCol =
      table?.cols.some((col) => col.fieldId != null) ?? false;
    const hasRow = (table?.rows.length ?? 0) > 0;
    const hasConditionCell =
      table?.rows.some((row) => Object.keys(row.cells).length > 0) ?? false;
    const hasConclusion =
      table?.rows.some(
        (row) =>
          row.conclusion.type === 'terminal' &&
          Object.values(row.conclusion.outputs).some(
            (value) => value.trim().length > 0,
          ),
      ) ?? false;

    return [
      {
        id: 'field',
        label: t.localGuideStepField,
        hint: t.localGuideHintField,
        done: hasField,
      },
      {
        id: 'condition',
        label: t.localGuideStepCondition,
        hint: t.localGuideHintCondition,
        done: hasAssignedConditionCol,
      },
      {
        id: 'row',
        label: t.localGuideStepRow,
        hint: t.localGuideHintRow,
        done: hasRow,
      },
      {
        id: 'conditionCell',
        label: t.localGuideStepConditionCell,
        hint: t.localGuideHintConditionCell,
        done: hasConditionCell,
      },
      {
        id: 'conclusion',
        label: t.localGuideStepConclusion,
        hint: t.localGuideHintConclusion,
        done: hasConclusion,
      },
      {
        id: 'evaluate',
        label: t.localGuideStepEvaluate,
        hint: evalDrawerOpen
          ? t.localGuideHintEvaluateRun
          : t.localGuideHintEvaluateOpen,
        done: evalResult != null,
      },
    ];
  }, [evalDrawerOpen, evalResult, logic.fieldDefs, table, t]);

  const activeStep = steps.find((step) => !step.done) ?? null;
  const completed = steps.every((step) => step.done);
  const floatingOffsetStyle = {
    right: evalDrawerOpen
      ? 'calc(360px + 1rem)'
      : activeStep?.id === 'evaluate'
        ? 'calc(44px + 1rem)'
        : '1rem',
  };

  useEffect(() => {
    if (!enabled || !tourActive || !activeStep) {
      document.documentElement.removeAttribute('data-local-tour-step');
      return;
    }
    document.documentElement.setAttribute(
      'data-local-tour-step',
      activeStep.id,
    );
    return () => {
      document.documentElement.removeAttribute('data-local-tour-step');
    };
  }, [enabled, tourActive, activeStep]);

  if (!enabled) return null;

  const startBlank = () => {
    setChoiceDismissed(true);
    setChoiceOpen(false);
  };

  const startTour = () => {
    setChoiceDismissed(true);
    setChoiceOpen(false);
    setTourActive(true);
  };

  return (
    <>
      {choiceOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-gray-950/35 p-4">
          <div className="w-full max-w-xl rounded border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {t.localStartTitle}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  {t.localStartDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={startBlank}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label={t.localGuideClose}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={startBlank}
                className="rounded border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <FilePlus2 className="h-5 w-5 text-gray-500" />
                <span className="mt-3 block text-sm font-semibold text-gray-900">
                  {t.localCreateBlankTitle}
                </span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">
                  {t.localCreateBlankDescription}
                </span>
              </button>
              <button
                type="button"
                onClick={startTour}
                className="rounded border border-violet-300 bg-violet-50 p-4 text-left transition-colors hover:border-violet-400 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                <div className="flex items-center justify-between gap-3">
                  <Sparkles className="h-5 w-5 text-violet-700" />
                  <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                    {t.localGuideRecommended}
                  </span>
                </div>
                <span className="mt-3 block text-sm font-semibold text-violet-950">
                  {t.localGuideTitle}
                </span>
                <span className="mt-1 block text-xs leading-5 text-violet-700">
                  {t.localGuideDescription}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {tourActive && (
        <div
          className="fixed bottom-4 z-[55] w-[min(360px,calc(100vw-32px))] rounded border border-gray-200 bg-white shadow-xl transition-[right] duration-200"
          style={floatingOffsetStyle}
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {completed
                    ? t.localGuideCompleteTitle
                    : t.localGuidePanelTitle}
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {completed
                    ? t.localGuideCompleteDescription
                    : activeStep?.hint}
                </p>
              </div>
            </div>
          </div>
          <ol className="space-y-1 px-3 py-3">
            {steps.map((step, index) => {
              const current = activeStep?.id === step.id;
              return (
                <li
                  key={step.id}
                  className={cn(
                    'flex items-start gap-2 rounded px-2 py-2 text-xs',
                    current && 'bg-violet-50 text-violet-900',
                    step.done && 'text-gray-500',
                    !current && !step.done && 'text-gray-700',
                  )}
                >
                  {step.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        current ? 'text-violet-700' : 'text-gray-300',
                      )}
                    />
                  )}
                  <span>
                    <span className="font-medium">
                      {index + 1}. {step.label}
                    </span>
                    {current && (
                      <span className="mt-0.5 block leading-5 text-violet-700">
                        {step.hint}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex justify-end border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setTourActive(false)}
              className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {completed ? t.localGuideClose : t.localGuideSkip}
            </button>
          </div>
        </div>
      )}

      {!choiceOpen && !tourActive && (
        <button
          type="button"
          onClick={startTour}
          className="fixed bottom-4 z-[45] flex items-center gap-1.5 rounded border border-violet-200 bg-white px-3 py-2 text-xs font-medium text-violet-700 shadow-lg transition-[right] duration-200 hover:bg-violet-50"
          style={floatingOffsetStyle}
        >
          <Sparkles size={14} />
          {t.localGuideShow}
        </button>
      )}
    </>
  );
}
