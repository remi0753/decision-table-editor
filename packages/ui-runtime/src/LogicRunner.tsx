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
          className="flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-strong"
        >
          <PlayIcon />
          {runLabel ?? 'Evaluate'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-muted"
        >
          <RotateCcwIcon />
          {resetLabel ?? 'Reset'}
        </button>
      </div>
      {result && (
        <div className="border-t pt-4">
          <div className="text-xs font-medium text-fg-subtle mb-2">
            {t.traceLabel}
          </div>
          <TraceView result={result} logic={logic} translations={t} />
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <title>Evaluate</title>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

function RotateCcwIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <title>Reset</title>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}
