import { type EvalResult, evaluateTable, type Logic } from '@leverie/engine';
import { useState } from 'react';
import { InputForm } from './InputForm.js';
import { TraceView } from './TraceView.js';
import {
  defaultTranslations,
  type UiRuntimeTranslations,
} from './translations.js';

interface LogicRunnerProps {
  logic: Logic;
  translations?: UiRuntimeTranslations;
  initialValues?: Record<string, string>;
  runLabel?: string;
  resetLabel?: string;
}

export function LogicRunner({
  logic,
  translations,
  initialValues,
  runLabel,
  resetLabel,
}: LogicRunnerProps) {
  const t = translations ?? defaultTranslations.en;
  const [values, setValues] = useState<Record<string, string>>(
    initialValues ?? {},
  );
  const [result, setResult] = useState<EvalResult | null>(null);

  const handleChange = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleRun = () => {
    setResult(evaluateTable(logic.entryTableId, values, logic));
  };

  const handleReset = () => {
    setValues({});
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <InputForm
        logic={logic}
        values={values}
        onChange={handleChange}
        translations={t}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRun}
          className="bg-violet-600 text-white text-sm px-3 py-1.5 rounded hover:bg-violet-700"
        >
          {runLabel ?? 'Evaluate'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-600"
        >
          {resetLabel ?? 'Reset'}
        </button>
      </div>
      {result && (
        <div className="border-t pt-4">
          <div className="text-xs font-medium text-gray-500 mb-2">
            {t.traceLabel}
          </div>
          <TraceView result={result} logic={logic} translations={t} />
        </div>
      )}
    </div>
  );
}
