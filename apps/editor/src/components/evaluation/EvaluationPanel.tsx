import { evaluateTable } from '@leverie/engine';
import { InputForm, TraceView } from '@leverie/ui-runtime';
import { PanelRightClose, PanelRightOpen, Play, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { toUiRuntimeTranslations } from '@/i18n/uiRuntime';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

export function EvaluationPanel() {
  const logic = useLogicStore((s) => s.logic);
  const evalInputs = useUiStore((s) => s.evalInputs);
  const setEvalInput = useUiStore((s) => s.setEvalInput);
  const clearEvalInputs = useUiStore((s) => s.clearEvalInputs);
  const result = useUiStore((s) => s.evalResult);
  const setResult = useUiStore((s) => s.setEvalResult);
  const clearResult = useUiStore((s) => s.clearEvalResult);
  const open = useUiStore((s) => s.evalDrawerOpen);
  const toggleDrawer = useUiStore((s) => s.toggleEvalDrawer);
  const t = useT();
  const runtimeT = useMemo(() => toUiRuntimeTranslations(t), [t]);

  const handleEvaluate = () => {
    const res = evaluateTable(logic.entryTableId, evalInputs, logic);
    setResult(res);
  };

  const handleReset = () => {
    clearEvalInputs();
    clearResult();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggleDrawer}
        data-tour-target="eval-open"
        aria-label={t.evaluationPanel}
        className="w-11 shrink-0 border-l bg-surface hover:bg-brand-subtle transition-colors flex flex-col items-center py-3 gap-3 text-fg-subtle"
      >
        <PanelRightOpen size={16} />
        <span
          className="text-xs font-medium tracking-wider"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t.evaluationPanel}
        </span>
      </button>
    );
  }

  return (
    <aside className="w-[360px] shrink-0 border-l bg-surface flex flex-col">
      <div className="border-b border-brand-border-subtle shrink-0">
        <div className="flex min-h-11 items-center justify-between bg-brand-subtle/50 px-4">
          <span className="font-medium text-sm text-fg-secondary">
            {t.evaluationPanel}
          </span>
          <button
            type="button"
            onClick={toggleDrawer}
            aria-label={t.evaluationPanel}
            className="p-1 -mr-1 rounded text-fg-faint hover:text-fg-muted hover:bg-surface-subtle"
          >
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <InputForm
          logic={logic}
          values={evalInputs}
          onChange={setEvalInput}
          translations={runtimeT}
          className="space-y-3"
          wrapperProps={{ 'data-tour-target': 'eval-inputs' }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            data-tour-target="eval-run"
            onClick={handleEvaluate}
            className="flex items-center gap-1 bg-brand text-white text-sm px-3 py-1.5 rounded hover:bg-brand-strong"
          >
            <Play size={14} /> {t.runEval}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 border text-sm px-3 py-1.5 rounded hover:bg-surface-muted text-fg-muted"
          >
            <RotateCcw size={14} /> {t.reset}
          </button>
        </div>
        {result && (
          <div className="border-t pt-4">
            <div className="text-xs font-medium text-fg-subtle mb-2">
              {t.traceLabel}
            </div>
            <TraceView result={result} logic={logic} translations={runtimeT} />
          </div>
        )}
      </div>
    </aside>
  );
}
