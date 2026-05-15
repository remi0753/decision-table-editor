import { ChevronDown, ChevronUp, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { evaluateTable } from '@/engine/evaluate';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { BatchPanel } from './BatchPanel';
import { InputForm } from './InputForm';
import { TraceView } from './TraceView';

type Tab = 'single' | 'batch';

export function EvaluationPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('single');
  const logic = useLogicStore((s) => s.logic);
  const evalInputs = useUiStore((s) => s.evalInputs);
  const clearEvalInputs = useUiStore((s) => s.clearEvalInputs);
  const result = useUiStore((s) => s.evalResult);
  const setResult = useUiStore((s) => s.setEvalResult);
  const clearResult = useUiStore((s) => s.clearEvalResult);
  const open = useUiStore((s) => s.evalDrawerOpen);
  const toggleDrawer = useUiStore((s) => s.toggleEvalDrawer);
  const t = useT();

  const handleEvaluate = () => {
    const res = evaluateTable(logic.entryTableId, evalInputs, logic);
    setResult(res);
  };

  const handleReset = () => {
    clearEvalInputs();
    clearResult();
  };

  return (
    <div
      className={cn(
        'border-t bg-white shrink-0 flex flex-col',
        open ? 'h-[60vh]' : 'h-auto',
      )}
    >
      <button
        type="button"
        onClick={toggleDrawer}
        className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-left shrink-0 border-b border-transparent data-[open=true]:border-gray-200"
        data-open={open}
      >
        <span className="font-medium text-sm">{t.evaluationPanel}</span>
        {open ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronUp size={16} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex border-b shrink-0 px-4">
            {(['single', 'batch'] as Tab[]).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 pb-2 pt-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'single' ? t.singleEval : t.batchEval}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {activeTab === 'single' && (
              <>
                <InputForm logic={logic} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleEvaluate}
                    className="flex items-center gap-1 bg-violet-600 text-white text-sm px-3 py-1.5 rounded hover:bg-violet-700"
                  >
                    <Play size={14} /> {t.runEval}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-600"
                  >
                    <RotateCcw size={14} /> {t.reset}
                  </button>
                </div>
                {result && (
                  <div className="border-t pt-4">
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      {t.traceLabel}
                    </div>
                    <TraceView result={result} logic={logic} />
                  </div>
                )}
              </>
            )}

            {activeTab === 'batch' && <BatchPanel logic={logic} />}
          </div>
        </div>
      )}
    </div>
  );
}
