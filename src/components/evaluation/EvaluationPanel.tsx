import { useState } from 'react';
import { ChevronDown, ChevronUp, Play, RotateCcw } from 'lucide-react';
import { type EvalResult } from '@/types/logic';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { evaluateTable } from '@/engine/evaluate';
import { InputForm } from './InputForm';
import { TraceView } from './TraceView';

export function EvaluationPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const logic = useLogicStore(s => s.logic);
  const evalInputs = useUiStore(s => s.evalInputs);
  const clearEvalInputs = useUiStore(s => s.clearEvalInputs);

  const handleEvaluate = () => {
    const res = evaluateTable(logic.entryTableId, evalInputs, logic);
    setResult(res);
  };

  const handleReset = () => {
    clearEvalInputs();
    setResult(null);
  };

  return (
    <div className="border rounded-lg bg-white mt-4">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="font-medium text-sm">評価パネル</span>
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-gray-600">
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4">
          <InputForm logic={logic} />

          <div className="flex gap-2">
            <button
              onClick={handleEvaluate}
              className="flex items-center gap-1 bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700"
            >
              <Play size={14} /> 評価実行
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-600"
            >
              <RotateCcw size={14} /> リセット
            </button>
          </div>

          {result && (
            <div className="border-t pt-4">
              <div className="text-xs font-medium text-gray-500 mb-2">実行トレース</div>
              <TraceView result={result} logic={logic} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
