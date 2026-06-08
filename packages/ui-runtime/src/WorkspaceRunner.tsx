import type { FieldDef, Logic } from '@leverie/engine';
import { useMemo, useState } from 'react';
import { TraceView } from './TraceView.js';
import {
  analyzeWorkspaceDecision,
  applyWorkspaceDefaults,
  buildRuntimeGroups,
  fieldHelp,
  fieldQuestion,
  normalizeWorkspaceInputs,
  valuesFromInitialInputs,
  visibleFieldIds,
  workspaceValuesToInputs,
} from './workspaceAnalysis.js';
import type {
  WorkspaceConfig,
  WorkspaceMode,
  WorkspaceRunnerProps,
  WorkspaceValueSource,
  WorkspaceValueState,
} from './workspaceTypes.js';

const inputBase =
  'w-full rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-fg placeholder-fg-faint focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand-border-strong';

export function WorkspaceRunner({
  logic,
  workspaceConfig,
  initialValues,
  initialSources,
  versionLabel,
  publishedAtLabel,
}: WorkspaceRunnerProps) {
  const initialValueState = useMemo(() => {
    const defaults = applyWorkspaceDefaults(logic, workspaceConfig);
    const normalizedInitial = initialValues
      ? normalizeWorkspaceInputs(
          logic,
          initialValues,
          workspaceConfig?.prefill?.acceptedAliases,
        )
      : {};
    const fromInitial: Record<string, WorkspaceValueState> = {};
    const now = new Date().toISOString();
    for (const [fieldId, value] of Object.entries(normalizedInitial)) {
      fromInitial[fieldId] = {
        fieldId,
        value,
        source: initialSources?.[fieldId] ?? 'url_query',
        status: value === '' ? 'missing' : 'known',
        updatedAt: now,
      };
    }
    return { ...defaults, ...fromInitial };
  }, [logic, workspaceConfig, initialValues, initialSources]);

  const [values, setValues] =
    useState<Record<string, WorkspaceValueState>>(initialValueState);
  const [mode, setMode] = useState<WorkspaceMode>(() =>
    chooseInitialMode(logic, initialValueState, workspaceConfig),
  );
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const analysis = useMemo(
    () => analyzeWorkspaceDecision(logic, values, workspaceConfig),
    [logic, values, workspaceConfig],
  );
  const groups = useMemo(
    () => buildRuntimeGroups(logic, workspaceConfig),
    [logic, workspaceConfig],
  );
  const visibleIds = useMemo(
    () => visibleFieldIds(logic, workspaceConfig, mode === 'detail'),
    [logic, workspaceConfig, mode],
  );
  const currentCheck = analysis.recommendedChecks[0];
  const currentFieldIds =
    mode === 'detail'
      ? visibleIds
      : (currentCheck?.fieldIds ?? analysis.missingFieldIds.slice(0, 1));

  const updateValue = (
    fieldId: string,
    value: string,
    source: WorkspaceValueSource = 'manual',
  ) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: {
        fieldId,
        value,
        source,
        status: value === '' ? 'missing' : 'known',
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const resetValues = () => {
    setValues(applyWorkspaceDefaults(logic, workspaceConfig));
    setMode(chooseInitialMode(logic, {}, workspaceConfig));
    setJsonDraft('');
    setJsonError(null);
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError('Paste a JSON object.');
        return;
      }
      const normalized = normalizeWorkspaceInputs(
        logic,
        parsed as Record<string, string>,
        workspaceConfig?.prefill?.acceptedAliases,
      );
      const fromJson = valuesFromInitialInputs(logic, normalized, 'json_paste');
      setValues((prev) => ({ ...prev, ...fromJson }));
      setJsonError(null);
      setMode('review');
    } catch {
      setJsonError('Could not parse JSON.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-fg-faint">
            LEVERIE Workspace
          </div>
          <div className="mt-1 text-sm text-fg-muted">
            {versionLabel ? <span>{versionLabel}</span> : null}
            {versionLabel && publishedAtLabel ? <span> / </span> : null}
            {publishedAtLabel ? <span>{publishedAtLabel}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['guided', 'review', 'detail'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={
                mode === item
                  ? 'rounded bg-brand px-3 py-1.5 text-xs font-medium text-white'
                  : 'rounded border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-muted'
              }
            >
              {modeLabel(item)}
            </button>
          ))}
          <button
            type="button"
            onClick={resetValues}
            className="rounded border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-muted"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(360px,1.25fr)_minmax(260px,0.9fr)]">
        <CaseFactsPanel
          logic={logic}
          values={values}
          visibleIds={visibleIds}
          missingFieldIds={analysis.missingFieldIds}
          onChange={updateValue}
          workspaceConfig={workspaceConfig}
          jsonDraft={jsonDraft}
          jsonError={jsonError}
          onJsonDraftChange={setJsonDraft}
          onApplyJson={applyJson}
        />
        <CurrentCheckPanel
          logic={logic}
          values={values}
          fieldIds={currentFieldIds}
          mode={mode}
          reason={currentCheck?.reason ?? analysis.reason}
          onChange={updateValue}
          workspaceConfig={workspaceConfig}
        />
        <DecisionStatusPanel
          logic={logic}
          analysis={analysis}
          values={values}
          groups={groups}
        />
      </div>

      <ResultPanel logic={logic} analysis={analysis} mode={mode} />
    </div>
  );
}

function CaseFactsPanel({
  logic,
  values,
  visibleIds,
  missingFieldIds,
  onChange,
  workspaceConfig,
  jsonDraft,
  jsonError,
  onJsonDraftChange,
  onApplyJson,
}: {
  logic: Logic;
  values: Record<string, WorkspaceValueState>;
  visibleIds: string[];
  missingFieldIds: string[];
  onChange: (fieldId: string, value: string) => void;
  workspaceConfig?: WorkspaceConfig;
  jsonDraft: string;
  jsonError: string | null;
  onJsonDraftChange: (value: string) => void;
  onApplyJson: () => void;
}) {
  const known = visibleIds.filter((fieldId) => values[fieldId]?.value);
  const missing = missingFieldIds.filter((fieldId) =>
    visibleIds.includes(fieldId),
  );

  return (
    <section className="rounded border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">Case Facts</h2>
        <span className="text-xs text-fg-faint">
          {known.length} known / {missing.length} needed
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {known.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No facts are filled yet. Start with the current check.
          </p>
        ) : (
          known.slice(0, 8).map((fieldId) => {
            const field = logic.fieldDefs[fieldId]!;
            const value = values[fieldId]!;
            return (
              <FactRow
                key={fieldId}
                field={field}
                value={value}
                onChange={onChange}
                workspaceConfig={workspaceConfig}
              />
            );
          })
        )}
      </div>

      {missing.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3">
          <div className="text-xs font-medium text-fg-subtle">Still needed</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.slice(0, 8).map((fieldId) => (
              <span
                key={fieldId}
                className="rounded border border-line bg-surface-muted px-2 py-1 text-xs text-fg-muted"
              >
                {logic.fieldDefs[fieldId]?.name ?? fieldId}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-medium text-fg-subtle">
          Paste JSON facts
        </summary>
        <textarea
          value={jsonDraft}
          onChange={(event) => onJsonDraftChange(event.target.value)}
          className="mt-2 h-24 w-full resize-y rounded border border-line-strong bg-surface px-2 py-1.5 font-mono text-xs text-fg focus:outline-none focus:ring-2 focus:ring-brand-ring"
          placeholder='{"Customer Type":"Gold"}'
        />
        {jsonError ? (
          <p className="mt-1 text-xs text-danger-fg">{jsonError}</p>
        ) : null}
        <button
          type="button"
          onClick={onApplyJson}
          className="mt-2 rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-strong"
        >
          Apply facts
        </button>
      </details>
    </section>
  );
}

function FactRow({
  field,
  value,
  onChange,
  workspaceConfig,
}: {
  field: FieldDef;
  value: WorkspaceValueState;
  onChange: (fieldId: string, value: string) => void;
  workspaceConfig?: WorkspaceConfig;
}) {
  return (
    <div className="rounded border border-line bg-surface-muted p-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`fact-${field.id}`}
          className="min-w-0 truncate text-xs font-medium text-fg-muted"
        >
          {fieldQuestion(field, workspaceConfig)}
        </label>
        <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[11px] text-fg-faint">
          {sourceLabel(value.source)}
        </span>
      </div>
      <input
        id={`fact-${field.id}`}
        value={value.value}
        onChange={(event) => onChange(field.id, event.target.value)}
        className="mt-1 w-full rounded border border-line bg-surface px-2 py-1 text-xs text-fg"
      />
    </div>
  );
}

function CurrentCheckPanel({
  logic,
  values,
  fieldIds,
  mode,
  reason,
  onChange,
  workspaceConfig,
}: {
  logic: Logic;
  values: Record<string, WorkspaceValueState>;
  fieldIds: string[];
  mode: WorkspaceMode;
  reason: string;
  onChange: (fieldId: string, value: string) => void;
  workspaceConfig?: WorkspaceConfig;
}) {
  return (
    <section className="rounded border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">
            {mode === 'detail' ? 'All Inputs' : 'Current Check'}
          </h2>
          <p className="mt-1 text-xs leading-5 text-fg-muted">{reason}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {fieldIds.length === 0 ? (
          <div className="rounded border border-line bg-surface-muted p-4 text-sm text-fg-muted">
            No more checks are needed for the current decision state.
          </div>
        ) : (
          fieldIds.map((fieldId) => {
            const field = logic.fieldDefs[fieldId];
            if (!field) return null;
            return (
              <QuestionField
                key={fieldId}
                field={field}
                value={values[fieldId]?.value ?? ''}
                onChange={(value) => onChange(fieldId, value)}
                workspaceConfig={workspaceConfig}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function QuestionField({
  field,
  value,
  onChange,
  workspaceConfig,
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
  workspaceConfig?: WorkspaceConfig;
}) {
  const help = fieldHelp(field, workspaceConfig);

  return (
    <div>
      <label
        htmlFor={`check-${field.id}`}
        className="block text-base font-semibold text-fg"
      >
        {fieldQuestion(field, workspaceConfig)}
      </label>
      {help ? (
        <p className="mt-1 text-xs leading-5 text-fg-muted">{help}</p>
      ) : null}
      <div className="mt-3">
        <FieldControl field={field} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'bool') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['true', 'Yes'],
            ['false', 'No'],
            ['', 'Unknown'],
          ] as Array<[string, string]>
        ).map(([optionValue, label]) => (
          <button
            key={optionValue || 'unset'}
            type="button"
            onClick={() => onChange(optionValue)}
            className={
              value === optionValue
                ? 'rounded bg-brand px-3 py-2 text-sm font-medium text-white'
                : 'rounded border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-muted'
            }
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === 'enum') {
    return (
      <select
        id={`check-${field.id}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputBase}
      >
        <option value="">Choose...</option>
        {(field.enumValues ?? []).map((enumValue) => (
          <option key={enumValue} value={enumValue}>
            {enumValue}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'date' || field.type === 'datetime') {
    return (
      <input
        id={`check-${field.id}`}
        type={field.type === 'date' ? 'date' : 'datetime-local'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputBase}
      />
    );
  }

  return (
    <input
      id={`check-${field.id}`}
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputBase} ${field.type === 'number' ? 'text-right tabular-nums' : ''}`}
      placeholder={`Enter ${field.name}`}
    />
  );
}

function DecisionStatusPanel({
  logic,
  analysis,
  values,
  groups,
}: {
  logic: Logic;
  analysis: ReturnType<typeof analyzeWorkspaceDecision>;
  values: Record<string, WorkspaceValueState>;
  groups: ReturnType<typeof buildRuntimeGroups>;
}) {
  const inputs = workspaceValuesToInputs(values);
  return (
    <section className="rounded border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">Decision Status</h2>
        <span className={statusClassName(analysis.status)}>
          {statusLabel(analysis.status)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-fg-muted">{analysis.reason}</p>

      <div className="mt-4 border-t border-line pt-3">
        <div className="text-xs font-medium text-fg-subtle">
          Possible outcomes
        </div>
        {analysis.possibleOutcomes.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">
            No outcome candidate yet.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {analysis.possibleOutcomes.slice(0, 5).map((outcome) => (
              <div
                key={outcome.key}
                className="rounded border border-line bg-surface-muted p-2 text-xs text-fg-muted"
              >
                <div className="font-medium text-fg">{outcome.label}</div>
                <div className="mt-0.5 text-fg-faint">{outcome.certainty}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="text-xs font-medium text-fg-subtle">Group progress</div>
        <div className="mt-2 space-y-2">
          {groups.map((group) => {
            const known = group.fieldIds.filter((fieldId) => inputs[fieldId]);
            return (
              <div key={group.id}>
                <div className="flex justify-between gap-2 text-xs">
                  <span className="truncate text-fg-muted">{group.name}</span>
                  <span className="shrink-0 text-fg-faint">
                    {known.length}/{group.fieldIds.length}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface-muted">
                  <div
                    className="h-full bg-brand"
                    style={{
                      width: `${
                        group.fieldIds.length === 0
                          ? 0
                          : (known.length / group.fieldIds.length) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {analysis.missingFieldIds.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3">
          <div className="text-xs font-medium text-fg-subtle">
            Missing queue
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-fg-muted">
            {analysis.missingFieldIds.slice(0, 8).map((fieldId) => (
              <li key={fieldId}>{logic.fieldDefs[fieldId]?.name ?? fieldId}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function ResultPanel({
  logic,
  analysis,
  mode,
}: {
  logic: Logic;
  analysis: ReturnType<typeof analyzeWorkspaceDecision>;
  mode: WorkspaceMode;
}) {
  if (analysis.status !== 'decision_ready' && analysis.status !== 'no_match') {
    return null;
  }

  if (analysis.status === 'no_match') {
    return (
      <section className="rounded border border-danger/40 bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-fg">
          No matching rule found
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          This combination is not covered by the current logic. Escalate or
          review the rule gap in LEVERIE Editor.
        </p>
      </section>
    );
  }

  const outputs =
    analysis.finalResult?.status === 'ok'
      ? analysis.finalResult.outputs
      : analysis.possibleOutcomes[0]?.outputs;

  return (
    <section className="rounded border border-brand-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg">Decision ready</h2>
          <p className="mt-1 text-sm text-fg-muted">{analysis.reason}</p>
        </div>
      </div>

      {outputs ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {Object.entries(outputs).map(([outputId, value]) => (
            <div
              key={outputId}
              className="rounded border border-line bg-surface-muted p-3"
            >
              <div className="text-xs font-medium text-fg-faint">
                {outputName(logic, outputId)}
              </div>
              <div className="mt-1 text-sm font-medium text-fg">
                {value || '(empty)'}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {analysis.finalResult && mode === 'detail' ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-2 text-xs font-medium text-fg-subtle">
            Trace summary
          </div>
          <TraceView result={analysis.finalResult} logic={logic} />
        </div>
      ) : null}
    </section>
  );
}

function chooseInitialMode(
  logic: Logic,
  values: Record<string, WorkspaceValueState>,
  config?: WorkspaceConfig,
): WorkspaceMode {
  const configured = config?.mode?.defaultMode;
  if (configured && configured !== 'auto') return configured;
  const known = Object.values(values).filter(
    (value) => value.value !== '',
  ).length;
  const total = Object.keys(logic.fieldDefs).length;
  return total > 0 && known / total >= 0.5 ? 'review' : 'guided';
}

function modeLabel(mode: WorkspaceMode): string {
  if (mode === 'guided') return 'Guided';
  if (mode === 'review') return 'Review';
  return 'Detail';
}

function sourceLabel(source: WorkspaceValueSource): string {
  switch (source) {
    case 'url_query':
      return 'From link';
    case 'json_paste':
      return 'From JSON';
    case 'embed':
      return 'From host';
    case 'api':
      return 'From API';
    case 'derived':
      return 'Calculated';
    case 'ai_extracted':
      return 'Extracted';
    case 'internal':
      return 'Internal';
    default:
      return 'Entered';
  }
}

function statusLabel(
  status: ReturnType<typeof analyzeWorkspaceDecision>['status'],
) {
  switch (status) {
    case 'decision_ready':
      return 'Decision ready';
    case 'needs_input':
      return 'Needs input';
    case 'needs_confirmation':
      return 'Needs confirmation';
    case 'no_match':
      return 'No match';
    case 'error':
      return 'Error';
    default:
      return 'Not started';
  }
}

function statusClassName(
  status: ReturnType<typeof analyzeWorkspaceDecision>['status'],
): string {
  const base = 'rounded px-2 py-1 text-xs font-medium';
  if (status === 'decision_ready')
    return `${base} bg-success-bg text-success-fg`;
  if (status === 'no_match') return `${base} bg-danger-bg text-danger-fg`;
  return `${base} bg-surface-muted text-fg-muted`;
}

function outputName(logic: Logic, outputId: string): string {
  for (const table of Object.values(logic.tables)) {
    const output = table.outputCols.find((col) => col.id === outputId);
    if (output) return output.name;
  }
  return outputId;
}
