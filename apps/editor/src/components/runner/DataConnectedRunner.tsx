import {
  analyzeWorkspaceDecision,
  type FactDefinition,
  factSourceToWorkspaceSource,
  factStateToWorkspaceStatus,
  type WorkspaceValueState,
} from '@leverie/ui-runtime';
import { Copy, Flag, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FactSheet, type FactSheetRow } from '@/components/runner/FactSheet';
import { NoMatchReportDialog } from '@/components/runner/NoMatchReportDialog';
import { StartCasePanel } from '@/components/runner/StartCasePanel';
import {
  completeDecisionSession,
  createCaseContext,
  type DecisionResult,
  type ExtractedKey,
  type ResolvedFactValue,
  type RunnerLogicResponse,
  resolveFacts,
  startDecisionSession,
} from '@/lib/cloudApi';

type Phase = 'start' | 'review' | 'result';
type FactProvenanceInput = Record<string, unknown>;
type UnavailableFact = { factId: string; reason: string };
type BlockedResolver = { resolverId: string; reason: string; factIds: string[] };

export function DataConnectedRunner({
  workspaceId,
  logicRef,
  data,
}: {
  workspaceId: string;
  logicRef: string;
  data: RunnerLogicResponse;
}) {
  const facts = useMemo(() => data.factDefinitions ?? [], [data]);
  const factById = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);
  const bindingByFactId = useMemo(
    () => new Map((data.factBindings ?? []).map((b) => [b.factId, b.fieldId])),
    [data],
  );
  const keyFacts = useMemo(
    () => facts.filter((f) => f.kind === 'key'),
    [facts],
  );
  const manualFacts = useMemo(
    () => facts.filter((f) => f.kind === 'manual_fact'),
    [facts],
  );

  const [phase, setPhase] = useState<Phase>('start');
  const [starting, setStarting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [caseContextId, setCaseContextId] = useState<string | null>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [keyProvenance, setKeyProvenance] = useState<
    Record<string, FactProvenanceInput>
  >({});
  const [keyCandidates, setKeyCandidates] = useState<ExtractedKey[]>([]);
  const [resolved, setResolved] = useState<ResolvedFactValue[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailableFact[]>([]);
  const [blocked, setBlocked] = useState<BlockedResolver[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [manualProvenance, setManualProvenance] = useState<
    Record<string, FactProvenanceInput>
  >({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [showReport, setShowReport] = useState(false);

  const resolvedByFactId = useMemo(
    () => new Map(resolved.map((v) => [v.factId, v])),
    [resolved],
  );

  const runResolve = async (
    contextId: string | null,
    keys: Record<string, string>,
    manual: Record<string, string>,
  ) => {
    const factInputs = [...Object.entries(keys), ...Object.entries(manual)]
      .filter(([, value]) => value !== '')
      .map(([factId, value]) => ({ factId, value, sourceKind: 'manual' }));
    const res = await resolveFacts(workspaceId, logicRef, {
      caseContextId: contextId,
      facts: factInputs,
    });
    setResolved(res.values);
    setUnavailable(res.unavailable ?? []);
    setBlocked(res.blocked ?? []);
  };

  const handleStart = async (text: string) => {
    setStarting(true);
    try {
      const { caseContext } = await createCaseContext(
        workspaceId,
        logicRef,
        text,
      );
      setCaseContextId(caseContext.id);
      setKeyCandidates(caseContext.extractedKeys);
      // Take the highest-confidence candidate per fact as the starting key.
      const keys: Record<string, string> = {};
      const provenance: Record<string, FactProvenanceInput> = {};
      const now = new Date().toISOString();
      for (const k of [...caseContext.extractedKeys].sort(
        (a, b) => b.confidence - a.confidence,
      ) as ExtractedKey[]) {
        if (!(k.factId in keys)) {
          keys[k.factId] = k.value;
          provenance[k.factId] = {
            retrievedAt: now,
            confidence: k.confidence,
            evidenceLabel: `${k.source} extraction`,
          };
        }
      }
      setKeyValues(keys);
      setKeyProvenance(provenance);
      await runResolve(caseContext.id, keys, {});
      setPhase('review');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start.');
    } finally {
      setStarting(false);
    }
  };

  const commitFactValue = async (factId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const fact = factById.get(factId);
    const now = new Date().toISOString();
    setResolving(true);
    try {
      if (fact?.kind === 'key') {
        const nextKeys = { ...keyValues, [factId]: trimmed };
        const nextProvenance = {
          ...keyProvenance,
          [factId]: {
            retrievedAt: now,
            evidenceLabel: 'operator edited key',
          },
        };
        setKeyValues(nextKeys);
        setKeyProvenance(nextProvenance);
        await runResolve(caseContextId, nextKeys, manualValues);
      } else {
        const nextManual = { ...manualValues, [factId]: trimmed };
        const nextProvenance = {
          ...manualProvenance,
          [factId]: {
            retrievedAt: now,
            evidenceLabel: 'operator answer',
          },
        };
        setManualValues(nextManual);
        setManualProvenance(nextProvenance);
        await runResolve(caseContextId, keyValues, nextManual);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Resolve failed.');
    } finally {
      setResolving(false);
    }
  };

  const handleReResolve = async () => {
    setResolving(true);
    try {
      await runResolve(caseContextId, keyValues, manualValues);
      toast.success('Facts re-resolved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Resolve failed.');
    } finally {
      setResolving(false);
    }
  };

  const handleDecide = async () => {
    setDeciding(true);
    try {
      // Build the fact-value set: resolved values, then keys and manual answers
      // (which override) — each carries its field id for server re-evaluation.
      const byFact = new Map<string, ResolvedFactValue>();
      for (const v of resolved) byFact.set(v.factId, v);
      const now = new Date().toISOString();
      for (const [factId, value] of Object.entries(keyValues)) {
        if (value === '') continue;
        byFact.set(factId, {
          factId,
          fieldId: bindingByFactId.get(factId),
          value,
          state: 'manual',
          sourceKind: 'manual',
          provenance: {
            retrievedAt: now,
            evidenceLabel: 'operator confirmed key',
            ...(keyProvenance[factId] ?? {}),
          },
        });
      }
      for (const [factId, value] of Object.entries(manualValues)) {
        if (value === '') continue;
        byFact.set(factId, {
          factId,
          fieldId: bindingByFactId.get(factId),
          value,
          state: 'manual',
          sourceKind: 'manual',
          provenance: {
            retrievedAt: now,
            evidenceLabel: 'operator answer',
            ...(manualProvenance[factId] ?? {}),
          },
        });
      }

      const { session } = await startDecisionSession(workspaceId, logicRef, {
        caseContextId,
      });
      setSessionId(session.id);
      const completion = await completeDecisionSession(session.id, {
        factValues: Array.from(byFact.values()),
      });
      setResult(completion.result);
      setPhase('result');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not decide.');
    } finally {
      setDeciding(false);
    }
  };

  const reset = () => {
    setPhase('start');
    setCaseContextId(null);
    setKeyValues({});
    setKeyProvenance({});
    setKeyCandidates([]);
    setResolved([]);
    setUnavailable([]);
    setBlocked([]);
    setManualValues({});
    setManualProvenance({});
    setSessionId(null);
    setResult(null);
  };

  if (phase === 'start') {
    return <StartCasePanel onStart={handleStart} starting={starting} />;
  }

  const canViewSensitive =
    data.runner.role === 'admin' || data.runner.role === 'owner';
  const displayValue = (fact: FactDefinition | undefined, value?: string) => {
    if (value === undefined) return undefined;
    if (fact?.sensitive && !canViewSensitive) return maskValue(value);
    return value;
  };

  // Rows for the fact sheet: keys, resolved values, unresolved fallbacks, and
  // manual corrections. The map keeps the latest operator correction visible.
  const sheetRowsByFactId = new Map<string, FactSheetRow>();
  for (const fact of keyFacts) {
    if (keyValues[fact.id]) {
      sheetRowsByFactId.set(fact.id, {
        factId: fact.id,
        name: fact.name,
        value: displayValue(fact, keyValues[fact.id]),
        rawValue: keyValues[fact.id],
        state: 'manual',
        sourceKind: 'manual',
        provenance: keyProvenance[fact.id],
        sensitive: fact.sensitive,
        editable: true,
      });
    }
  }
  for (const value of resolved) {
    const fact = factById.get(value.factId);
    sheetRowsByFactId.set(value.factId, {
      factId: value.factId,
      name: fact?.name ?? value.factId,
      value:
        value.maskedValue ??
        displayValue(fact, value.value) ??
        (value.state === 'needs_confirmation' ? undefined : value.value),
      rawValue: value.value,
      state: value.state,
      sourceKind: value.sourceKind,
      sensitive: fact?.sensitive,
      provenance: value.provenance,
      editable: value.state !== 'hidden',
    });
  }
  for (const missing of unavailable) {
    const fact = factById.get(missing.factId);
    if (sheetRowsByFactId.has(missing.factId)) continue;
    sheetRowsByFactId.set(missing.factId, {
      factId: missing.factId,
      name: fact?.name ?? missing.factId,
      state: 'unavailable',
      sourceKind: 'reference_table',
      sensitive: fact?.sensitive,
      provenance: { evidenceLabel: missing.reason },
      editable: true,
    });
  }
  for (const [factId, value] of Object.entries(manualValues)) {
    if (!value) continue;
    const fact = factById.get(factId);
    sheetRowsByFactId.set(factId, {
      factId,
      name: fact?.name ?? factId,
      value: displayValue(fact, value),
      rawValue: value,
      state: 'manual',
      sourceKind: 'manual',
      sensitive: fact?.sensitive,
      provenance: manualProvenance[factId],
      editable: true,
    });
  }
  const sheetRows = Array.from(sheetRowsByFactId.values());

  // Project the current facts into field-keyed values and run partial decision
  // analysis, so we ask only the manual facts the decision still needs (§9.4).
  const now = new Date().toISOString();
  const fieldValues: Record<string, WorkspaceValueState> = {};
  for (const value of resolved) {
    if (!value.fieldId || value.value === undefined) continue;
    fieldValues[value.fieldId] = {
      fieldId: value.fieldId,
      value: value.value,
      source: factSourceToWorkspaceSource(
        value.sourceKind as Parameters<typeof factSourceToWorkspaceSource>[0],
      ),
      status: factStateToWorkspaceStatus(
        value.state as Parameters<typeof factStateToWorkspaceStatus>[0],
      ),
      updatedAt: now,
    };
  }
  for (const fact of keyFacts) {
    const fieldId = bindingByFactId.get(fact.id);
    const value = keyValues[fact.id];
    if (!fieldId || !value) continue;
    fieldValues[fieldId] = {
      fieldId,
      value,
      source: 'manual',
      status: 'known',
      updatedAt: now,
    };
  }
  for (const [factId, value] of Object.entries(manualValues)) {
    const fieldId = bindingByFactId.get(factId);
    if (!fieldId || !value) continue;
    fieldValues[fieldId] = {
      fieldId,
      value,
      source: 'manual',
      status: 'known',
      updatedAt: now,
    };
  }

  const analysis = analyzeWorkspaceDecision(
    data.version.data,
    fieldValues,
    data.version.workspaceConfig ?? undefined,
  );
  const missingFieldIds = new Set(analysis.missingFieldIds);

  // Ask a manual fact only when its bound field is still needed by the decision
  // and it has not already been resolved or answered.
  const pendingManual = manualFacts.filter((f) => {
    if (resolvedByFactId.has(f.id)) return false;
    if (manualValues[f.id]) return false;
    const fieldId = bindingByFactId.get(f.id);
    // Unbound manual facts can't drive the engine, so fall back to asking them.
    return fieldId ? missingFieldIds.has(fieldId) : true;
  });
  const currentManual = pendingManual.slice(0, 1);
  const needsConfirmation = sheetRows.some(
    (row) =>
      (row.state === 'needs_confirmation' || row.state === 'invalid') &&
      !manualValues[row.factId],
  );
  const canDecide =
    !deciding &&
    blocked.length === 0 &&
    !needsConfirmation &&
    pendingManual.length === 0 &&
    (analysis.status === 'decision_ready' || analysis.status === 'no_match');
  const decideBlockedReason =
    blocked.length > 0
      ? 'Resolve the blocked data issue before deciding.'
      : needsConfirmation
        ? 'Confirm or correct highlighted facts before deciding.'
        : pendingManual.length > 0
          ? 'Answer the current question before deciding.'
          : analysis.status === 'needs_input'
            ? analysis.reason
            : null;
  const factsUsed = sheetRows.filter((row) => row.value);
  const skippedFacts = facts.filter((fact) => {
    if (factsUsed.some((row) => row.factId === fact.id)) return false;
    const fieldId = bindingByFactId.get(fact.id);
    return fieldId ? !missingFieldIds.has(fieldId) : false;
  });

  if (phase === 'review') {
    return (
      <div className="space-y-5">
        {keyFacts.length > 0 ? (
          <div className="rounded border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Case keys</h2>
            <div className="mt-3 space-y-2">
              {keyFacts.map((fact) => (
                <label key={fact.id} className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {fact.name}
                  </span>
                  <input
                    value={keyValues[fact.id] ?? ''}
                    onChange={(event) =>
                      setKeyValues((current) => ({
                        ...current,
                        [fact.id]: event.target.value,
                      }))
                    }
                    className="h-10 w-full max-w-sm rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                  />
                </label>
              ))}
              {keyCandidates.length > 0 ? (
                <div className="rounded border border-line-subtle bg-surface-muted px-3 py-2">
                  <div className="text-xs font-medium text-fg-subtle">
                    Extracted candidates
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {keyCandidates.slice(0, 6).map((candidate) => (
                      <button
                        key={`${candidate.factId}:${candidate.value}:${candidate.source}`}
                        type="button"
                        onClick={() =>
                          void commitFactValue(candidate.factId, candidate.value)
                        }
                        className="rounded border border-line bg-surface px-2 py-1 text-xs text-fg-muted hover:bg-surface-muted"
                      >
                        {candidate.label}: {candidate.value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void handleReResolve()}
                disabled={resolving}
                className="mt-1 inline-flex h-9 items-center gap-2 rounded border border-line px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted disabled:opacity-50"
              >
                {resolving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Re-resolve facts
              </button>
            </div>
          </div>
        ) : null}

        <FactSheet rows={sheetRows} onCorrect={commitFactValue} />

        {blocked.length > 0 ? (
          <div className="rounded border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
            A resolver fallback blocked this case. Review the data source or
            correct the missing facts before deciding.
          </div>
        ) : null}

        {currentManual.length > 0 ? (
          <div className="rounded border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Questions</h2>
            <p className="mt-1 text-xs text-fg-subtle">
              Answer what systems can't know.
            </p>
            <div className="mt-3 space-y-4">
              {currentManual.map((fact) => (
                <ManualQuestion
                  key={fact.id}
                  fact={fact}
                  value={manualValues[fact.id] ?? ''}
                  onAnswer={(value) => void commitFactValue(fact.id, value)}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded border border-line bg-surface px-4 py-3 text-sm text-fg-muted">
            {analysis.reason}
          </p>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded border border-line px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
          >
            <RotateCcw className="h-4 w-4" />
            Start over
          </button>
          <button
            type="button"
            onClick={() => void handleDecide()}
            disabled={!canDecide}
            className="inline-flex h-10 items-center gap-2 rounded bg-brand px-5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
            title={decideBlockedReason ?? undefined}
          >
            {deciding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Decide
          </button>
        </div>
        {decideBlockedReason ? (
          <p className="text-right text-xs text-fg-subtle">
            {decideBlockedReason}
          </p>
        ) : null}
      </div>
    );
  }

  // phase === 'result'
  return (
    <div className="space-y-5">
      {result?.status === 'ok' ? (
        <ResultCard
          result={result}
          logicName={data.logic.name}
          versionNumber={data.version.versionNumber}
          snapshotHash={data.dataSnapshot?.snapshotHash}
          sessionId={sessionId}
          factsUsed={factsUsed}
          skippedFacts={skippedFacts}
          onReport={() => setShowReport(true)}
        />
      ) : (
        <NoMatchCard
          logicName={data.logic.name}
          versionNumber={data.version.versionNumber}
          snapshotHash={data.dataSnapshot?.snapshotHash}
          sessionId={sessionId}
          facts={sheetRows}
          onReport={() => setShowReport(true)}
        />
      )}
      <FactSheet rows={sheetRows} onCorrect={commitFactValue} />
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center gap-2 rounded border border-line px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
      >
        <RotateCcw className="h-4 w-4" />
        New case
      </button>

      {showReport && sessionId ? (
        <NoMatchReportDialog
          sessionId={sessionId}
          defaultKind={
            result?.status === 'no_match' ? 'no_match' : 'wrong_result_text'
          }
          onClose={() => setShowReport(false)}
        />
      ) : null}
    </div>
  );
}

function ManualQuestion({
  fact,
  value,
  onAnswer,
}: {
  fact: FactDefinition;
  value: string;
  onAnswer: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const question = fact.question ?? fact.name;
  if (fact.type === 'bool') {
    return (
      <div>
        <p className="mb-1.5 text-sm font-medium text-fg">{question}</p>
        <div className="inline-flex overflow-hidden rounded border border-line">
          {[
            { v: 'true', label: 'Yes' },
            { v: 'false', label: 'No' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => onAnswer(opt.v)}
              className={`h-9 px-4 text-sm font-medium ${
                value === opt.v
                  ? 'bg-brand text-white'
                  : 'bg-surface text-fg-muted hover:bg-surface-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (fact.type === 'enum') {
    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-fg">
          {question}
        </span>
        <select
          value={value}
          onChange={(event) => {
            if (event.target.value) onAnswer(event.target.value);
          }}
          className="h-10 w-full max-w-sm rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
        >
          <option value="">— choose —</option>
          {(fact.enumValues ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">
        {question}
      </span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onAnswer(draft);
        }}
        className="h-10 w-full max-w-sm rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
      />
      <button
        type="button"
        onClick={() => onAnswer(draft)}
        disabled={!draft.trim()}
        className="mt-2 inline-flex h-9 items-center rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
      >
        Save answer
      </button>
    </label>
  );
}

function ResultCard({
  result,
  logicName,
  versionNumber,
  snapshotHash,
  sessionId,
  factsUsed,
  skippedFacts,
  onReport,
}: {
  result: { status: 'ok'; outputs: Record<string, string> };
  logicName: string;
  versionNumber: number;
  snapshotHash?: string;
  sessionId: string | null;
  factsUsed: FactSheetRow[];
  skippedFacts: FactDefinition[];
  onReport: () => void;
}) {
  const outputs = Object.entries(result.outputs);
  const reason =
    outputs.find(([key]) => key.toLowerCase() === 'reason')?.[1] ??
    `Evaluated by ${logicName} v${versionNumber}.`;
  const copyText = [
    ...outputs.map(([k, v]) => `${k}: ${v}`),
    `Reason: ${reason}`,
    `Logic version: v${versionNumber}`,
    snapshotHash ? `Data definition: ${snapshotHash}` : undefined,
    sessionId ? `Decision session: ${sessionId}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      toast.success('Copied.');
    } catch {
      toast.error('Could not copy.');
    }
  };
  return (
    <div className="rounded border border-success-border bg-success-bg/30 p-5">
      <h2 className="text-lg font-semibold text-fg">Decision</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{reason}</p>
      <dl className="mt-3 space-y-1.5">
        {outputs.map(([key, value]) => (
          <div key={key} className="flex gap-2 text-sm">
            <dt className="font-medium text-fg-muted">{key}:</dt>
            <dd className="font-semibold text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-fg-subtle">
        Based on company rule {logicName} v{versionNumber}.
        {snapshotHash ? ` Data definition ${snapshotHash.slice(0, 8)}.` : ''}
        {sessionId ? ` Decision session ${sessionId.slice(0, 8)}.` : ''}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FactSummaryList title="Facts used" rows={factsUsed} />
        <div className="rounded border border-line-subtle bg-surface px-3 py-2">
          <div className="text-xs font-medium text-fg-subtle">
            Facts skipped
          </div>
          {skippedFacts.length > 0 ? (
            <ul className="mt-1 space-y-1 text-xs text-fg-muted">
              {skippedFacts.slice(0, 6).map((fact) => (
                <li key={fact.id}>{fact.name}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-fg-faint">None</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-9 items-center gap-2 rounded border border-line bg-surface px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
        >
          <Copy className="h-4 w-4" />
          Copy result
        </button>
        <button
          type="button"
          onClick={onReport}
          className="inline-flex h-9 items-center gap-2 rounded border border-line bg-surface px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
        >
          <Flag className="h-4 w-4" />
          Report issue
        </button>
      </div>
    </div>
  );
}

function NoMatchCard({
  logicName,
  versionNumber,
  snapshotHash,
  sessionId,
  facts,
  onReport,
}: {
  logicName: string;
  versionNumber: number;
  snapshotHash?: string;
  sessionId: string | null;
  facts: FactSheetRow[];
  onReport: () => void;
}) {
  const escalation = [
    `No matching ${logicName} v${versionNumber} rule was found.`,
    'Known facts:',
    ...facts.filter((f) => f.value).map((f) => `- ${f.name}: ${f.value}`),
    '',
    'Please review this case or update the rule.',
    `Logic version: v${versionNumber}`,
    snapshotHash ? `Data definition: ${snapshotHash}` : '',
    sessionId ? `Decision session: ${sessionId}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(escalation);
      toast.success('Escalation copied.');
    } catch {
      toast.error('Could not copy.');
    }
  };

  return (
    <div className="rounded border border-warning-border bg-warning-bg/30 p-5">
      <h2 className="text-lg font-semibold text-fg">No matching rule</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        The current rules don't cover this case. Escalate it or report a rule
        gap so the logic owner can review.
      </p>
      <p className="mt-3 text-xs text-fg-subtle">
        Based on company rule {logicName} v{versionNumber}.
        {snapshotHash ? ` Data definition ${snapshotHash.slice(0, 8)}.` : ''}
        {sessionId ? ` Decision session ${sessionId.slice(0, 8)}.` : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-9 items-center gap-2 rounded border border-line bg-surface px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
        >
          <Copy className="h-4 w-4" />
          Copy escalation
        </button>
        <button
          type="button"
          onClick={onReport}
          className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
        >
          <Flag className="h-4 w-4" />
          Report rule gap
        </button>
      </div>
    </div>
  );
}

function FactSummaryList({
  title,
  rows,
}: {
  title: string;
  rows: FactSheetRow[];
}) {
  return (
    <div className="rounded border border-line-subtle bg-surface px-3 py-2">
      <div className="text-xs font-medium text-fg-subtle">{title}</div>
      {rows.length > 0 ? (
        <ul className="mt-1 space-y-1 text-xs text-fg-muted">
          {rows.slice(0, 6).map((row) => (
            <li key={row.factId}>
              {row.name}: {row.value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-fg-faint">None</p>
      )}
    </div>
  );
}

function maskValue(raw: string) {
  return raw.length > 8 ? `••••${raw.slice(-4)}` : '••••';
}
