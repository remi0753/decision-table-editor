import {
  type Cell,
  cmp,
  coerce,
  type EvalResult,
  evaluateTable,
  type FieldDef,
  type Logic,
  type Row,
  today,
} from '@leverie/engine';
import type {
  WorkspaceConfig,
  WorkspaceDecisionState,
  WorkspaceOutcomeCandidate,
  WorkspaceRecommendedCheck,
  WorkspaceResultTemplate,
  WorkspaceRuntimeGroup,
  WorkspaceValueSource,
  WorkspaceValueState,
} from './workspaceTypes.js';

const MAX_DEPTH = 50;
const MAX_CANDIDATES = 1000;

type PartialConditionResult = 'satisfied' | 'failed' | 'unknown';
type PartialRowState = 'definitely_matches' | 'cannot_match' | 'could_match';

type PathCandidate = {
  certainty: 'definite' | 'possible';
  outputs?: Record<string, string>;
  missingFieldIds: Set<string>;
};

export type WorkspaceFormattedResult = {
  title: string;
  reason: string;
  copyText: string;
  customerMessage?: string;
  internalNote?: string;
  template?: WorkspaceResultTemplate;
  outputsByName: Record<string, string>;
};

export function normalizeWorkspaceInputs(
  logic: Logic,
  raw: Record<string, string>,
  aliases: Record<string, string[]> = {},
): Record<string, string> {
  const result: Record<string, string> = {};
  const normalizedNameToId = new Map<string, string>();
  const aliasToId = new Map<string, string>();

  for (const [fieldId, field] of Object.entries(logic.fieldDefs)) {
    normalizedNameToId.set(normalizeKey(field.name), fieldId);
    for (const alias of aliases[fieldId] ?? []) {
      aliasToId.set(normalizeKey(alias), fieldId);
    }
  }

  for (const [key, value] of Object.entries(raw)) {
    if (key in logic.fieldDefs) {
      result[key] = value;
    }
  }

  for (const [key, value] of Object.entries(raw)) {
    if (key in logic.fieldDefs) continue;
    const id =
      Object.values(logic.fieldDefs).find((field) => field.name === key)?.id ??
      aliasToId.get(normalizeKey(key)) ??
      normalizedNameToId.get(normalizeKey(key));
    if (id && !(id in result)) {
      result[id] = value;
    }
  }

  return result;
}

export function valuesFromInitialInputs(
  logic: Logic,
  inputs: Record<string, string>,
  source: WorkspaceValueSource,
): Record<string, WorkspaceValueState> {
  const now = new Date().toISOString();
  const values: Record<string, WorkspaceValueState> = {};
  for (const [fieldId, value] of Object.entries(inputs)) {
    if (!(fieldId in logic.fieldDefs)) continue;
    values[fieldId] = {
      fieldId,
      value,
      source,
      status: value === '' ? 'missing' : 'known',
      updatedAt: now,
    };
  }
  return values;
}

export function buildRuntimeGroups(
  logic: Logic,
  config?: WorkspaceConfig,
  context: {
    values?: Record<string, WorkspaceValueState>;
    decision?: WorkspaceDecisionState;
    visibleFieldIds?: string[];
  } = {},
): WorkspaceRuntimeGroup[] {
  const configuredGroups = config?.groups ?? [];
  if (configuredGroups.length > 0) {
    const groups = configuredGroups.map((group, index) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      fieldIds: group.fieldIds.filter((fieldId) => fieldId in logic.fieldDefs),
      order: group.order ?? index,
    }));
    const assigned = new Set(groups.flatMap((group) => group.fieldIds));
    const other = Object.keys(logic.fieldDefs).filter(
      (fieldId) => !assigned.has(fieldId),
    );
    return other.length === 0
      ? groups
      : [
          ...groups,
          {
            id: 'other',
            name: 'Other',
            fieldIds: other,
            order: Number.MAX_SAFE_INTEGER,
          },
        ];
  }

  return buildDefaultRuntimeGroups(logic, config, context);
}

function buildDefaultRuntimeGroups(
  logic: Logic,
  config: WorkspaceConfig | undefined,
  context: {
    values?: Record<string, WorkspaceValueState>;
    decision?: WorkspaceDecisionState;
    visibleFieldIds?: string[];
  },
): WorkspaceRuntimeGroup[] {
  const visible = new Set(
    context.visibleFieldIds ?? visibleFieldIds(logic, config, true),
  );
  const assigned = new Set<string>();

  const addGroup = (
    id: string,
    name: string,
    fieldIds: string[],
    order: number,
    description?: string,
  ): WorkspaceRuntimeGroup | null => {
    const uniqueFieldIds = unique(
      fieldIds.filter((fieldId) => fieldId in logic.fieldDefs),
    ).filter((fieldId) => {
      if (assigned.has(fieldId)) return false;
      assigned.add(fieldId);
      return true;
    });

    if (uniqueFieldIds.length === 0) return null;
    return {
      id,
      name,
      description,
      fieldIds: uniqueFieldIds,
      order,
    };
  };

  const needsAttention = unique(
    context.decision?.recommendedChecks.flatMap((check) => check.fieldIds) ??
      context.decision?.blockingFieldIds ??
      [],
  ).filter((fieldId) => visible.has(fieldId));

  const internal = Object.keys(logic.fieldDefs).filter((fieldId) => {
    const fieldConfig = config?.fields?.[fieldId];
    return (
      fieldConfig?.source === 'internal' ||
      fieldConfig?.visibility === 'hidden' ||
      context.values?.[fieldId]?.source === 'internal'
    );
  });

  const known = Object.entries(context.values ?? {})
    .filter(([, value]) => value.value !== '')
    .map(([fieldId]) => fieldId)
    .filter((fieldId) => visible.has(fieldId));

  const missing = (context.decision?.missingFieldIds ?? []).filter((fieldId) =>
    visible.has(fieldId),
  );

  const other = Object.keys(logic.fieldDefs).filter(
    (fieldId) => visible.has(fieldId) && !assigned.has(fieldId),
  );

  return [
    addGroup(
      'needs_attention',
      'Needs attention',
      needsAttention,
      0,
      'Facts that currently advance the decision.',
    ),
    addGroup('internal', 'Internal facts', internal, 1),
    addGroup('known', 'Known facts', known, 2),
    addGroup('missing', 'Missing facts', missing, 3),
    addGroup('other', 'Other', other, 4),
  ].filter((group): group is WorkspaceRuntimeGroup => group !== null);
}

export function fieldQuestion(
  field: FieldDef,
  config?: WorkspaceConfig,
): string {
  const fieldConfig = config?.fields?.[field.id];
  return fieldConfig?.question ?? fieldConfig?.shortLabel ?? field.name;
}

export function fieldHelp(
  field: FieldDef,
  config?: WorkspaceConfig,
): string | undefined {
  return config?.fields?.[field.id]?.helpText;
}

export function visibleFieldIds(
  logic: Logic,
  config?: WorkspaceConfig,
  includeDetailOnly = false,
): string[] {
  return Object.keys(logic.fieldDefs).filter((fieldId) => {
    const visibility = config?.fields?.[fieldId]?.visibility ?? 'normal';
    if (visibility === 'hidden') return false;
    if (visibility === 'detail_only') return includeDetailOnly;
    return true;
  });
}

export function applyWorkspaceDefaults(
  logic: Logic,
  config?: WorkspaceConfig,
): Record<string, WorkspaceValueState> {
  const now = new Date().toISOString();
  const values: Record<string, WorkspaceValueState> = {};
  for (const [fieldId, fieldConfig] of Object.entries(config?.fields ?? {})) {
    if (!(fieldId in logic.fieldDefs)) continue;
    if (fieldConfig.defaultValue === undefined) continue;
    values[fieldId] = {
      fieldId,
      value: fieldConfig.defaultValue,
      source: 'manual',
      status: fieldConfig.defaultValue === '' ? 'missing' : 'known',
      updatedAt: now,
    };
  }
  return values;
}

export function workspaceValuesToInputs(
  values: Record<string, WorkspaceValueState>,
): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const [fieldId, state] of Object.entries(values)) {
    if (state.value !== '') inputs[fieldId] = state.value;
  }
  return inputs;
}

export function formatWorkspaceResultSummary(
  logic: Logic,
  outputs: Record<string, string>,
  config?: WorkspaceConfig,
  values: Record<string, WorkspaceValueState> = {},
  versionLabel?: string,
): WorkspaceFormattedResult {
  const template = selectResultTemplate(logic, outputs, config);
  const outputsByName = Object.fromEntries(
    Object.entries(outputs).map(([outputId, value]) => [
      outputName(logic, outputId),
      value,
    ]),
  );
  const context = buildTemplateContext(logic, outputs, outputsByName, values);
  const firstOutputValue = Object.values(outputs).find(Boolean);
  const fallbackTitle = firstOutputValue || 'Decision ready';
  const reasonOutput = outputByNormalizedName(outputsByName, 'reason');
  const fallbackReason =
    reasonOutput ??
    `Evaluated by LEVERIE logic${versionLabel ? ` ${versionLabel}` : ''}.`;
  const title = renderTemplate(template?.title, context) || fallbackTitle;
  const reason =
    renderTemplate(template?.reasonTemplate, context) || fallbackReason;
  const customerMessage = renderTemplate(
    template?.customerMessageTemplate,
    context,
  );
  const internalNote = renderTemplate(template?.internalNoteTemplate, context);
  const copyText =
    customerMessage ||
    [
      title,
      reason ? `Reason: ${reason}` : undefined,
      ...Object.entries(outputsByName).map(
        ([name, value]) => `${name}: ${value}`,
      ),
    ]
      .filter(Boolean)
      .join('\n');

  return {
    title,
    reason,
    copyText,
    customerMessage,
    internalNote,
    template,
    outputsByName,
  };
}

export function selectResultTemplate(
  logic: Logic,
  outputs: Record<string, string>,
  config?: WorkspaceConfig,
): WorkspaceResultTemplate | undefined {
  return config?.resultTemplates?.find((template) =>
    resultTemplateMatches(logic, outputs, template),
  );
}

export function analyzeWorkspaceDecision(
  logic: Logic,
  values: Record<string, WorkspaceValueState>,
  config?: WorkspaceConfig,
): WorkspaceDecisionState {
  const inputs = workspaceValuesToInputs(values);
  const candidates = analyzeTable(logic.entryTableId, logic, inputs, 0);
  const visible = new Set(visibleFieldIds(logic, config));
  const missingFieldIds = unique(
    candidates.flatMap((candidate) => Array.from(candidate.missingFieldIds)),
  ).filter((fieldId) => visible.has(fieldId));

  if (candidates.length === 0) {
    return {
      status: Object.keys(inputs).length === 0 ? 'not_started' : 'no_match',
      possibleOutcomes: [],
      recommendedChecks: [],
      missingFieldIds: [],
      blockingFieldIds: [],
      reason:
        Object.keys(inputs).length === 0
          ? 'Start by answering the first relevant check.'
          : 'No remaining rule can match the current facts.',
    };
  }

  const possibleOutcomes = buildOutcomes(candidates);
  const hasUnconfirmed = Object.values(values).some(
    (value) => value.status === 'needs_confirmation',
  );
  const finalOutputs = equivalentOutputs(candidates);
  const evaluation = evaluateTable(logic.entryTableId, inputs, logic);
  const finalResult: EvalResult | undefined =
    finalOutputs &&
    !hasUnconfirmed &&
    evaluation.status === 'ok' &&
    stableOutputsKey(evaluation.outputs) === stableOutputsKey(finalOutputs)
      ? evaluation
      : undefined;

  const recommendedChecks = selectRecommendedChecks(
    logic,
    missingFieldIds,
    candidates,
    config,
  );

  if (hasUnconfirmed) {
    return {
      status: 'needs_confirmation',
      finalResult,
      possibleOutcomes,
      recommendedChecks,
      missingFieldIds,
      blockingFieldIds: missingFieldIds,
      reason: 'Confirm the highlighted facts before using the final decision.',
    };
  }

  if (finalOutputs) {
    return {
      status: 'decision_ready',
      finalResult,
      possibleOutcomes,
      recommendedChecks: [],
      missingFieldIds,
      blockingFieldIds: [],
      reason: 'The remaining unanswered fields do not change the decision.',
    };
  }

  return {
    status: 'needs_input',
    possibleOutcomes,
    recommendedChecks,
    missingFieldIds,
    blockingFieldIds: missingFieldIds,
    reason:
      missingFieldIds.length === 1
        ? 'Answer one more check to narrow the decision.'
        : 'Additional facts are needed to determine the decision.',
  };
}

function analyzeTable(
  tableId: string,
  logic: Logic,
  inputs: Record<string, string>,
  depth: number,
): PathCandidate[] {
  if (depth > MAX_DEPTH) return [];
  const table = logic.tables[tableId];
  if (!table) return [];

  const candidates: PathCandidate[] = [];
  let earlierCouldMatch = false;

  for (const row of table.rows) {
    if (candidates.length > MAX_CANDIDATES) break;

    const result = partialRowState(row, table.cols, logic, inputs);
    if (result.state === 'cannot_match') continue;

    const certainty =
      result.state === 'definitely_matches' && !earlierCouldMatch
        ? 'definite'
        : 'possible';

    const rowCandidates = candidatesForConclusion(
      row,
      certainty,
      result.missingFieldIds,
      logic,
      inputs,
      depth,
    );
    candidates.push(...rowCandidates);

    if (result.state === 'could_match') {
      earlierCouldMatch = true;
      continue;
    }

    if (!earlierCouldMatch) {
      break;
    }
  }

  return candidates;
}

function candidatesForConclusion(
  row: Row,
  certainty: 'definite' | 'possible',
  missingFieldIds: Set<string>,
  logic: Logic,
  inputs: Record<string, string>,
  depth: number,
): PathCandidate[] {
  if (row.conclusion.type === 'terminal') {
    return [
      {
        certainty,
        outputs: row.conclusion.outputs,
        missingFieldIds,
      },
    ];
  }

  const next = analyzeTable(row.conclusion.tableId, logic, inputs, depth + 1);
  return next.map((candidate) => ({
    ...candidate,
    certainty:
      certainty === 'possible' || candidate.certainty === 'possible'
        ? 'possible'
        : 'definite',
    missingFieldIds: unionSets(missingFieldIds, candidate.missingFieldIds),
  }));
}

function partialRowState(
  row: Row,
  cols: Logic['tables'][string]['cols'],
  logic: Logic,
  inputs: Record<string, string>,
): { state: PartialRowState; missingFieldIds: Set<string> } {
  const missingFieldIds = new Set<string>();
  let hasUnknown = false;

  for (const col of cols) {
    const cell = row.cells[col.id];
    if (!cell || !col.fieldId) continue;
    const field = logic.fieldDefs[col.fieldId];
    if (!field) continue;
    const result = partialCellMatches(cell, inputs[col.fieldId], field);
    if (result === 'failed') {
      return { state: 'cannot_match', missingFieldIds };
    }
    if (result === 'unknown') {
      hasUnknown = true;
      missingFieldIds.add(col.fieldId);
    }
  }

  return {
    state: hasUnknown ? 'could_match' : 'definitely_matches',
    missingFieldIds,
  };
}

function partialCellMatches(
  cell: Cell,
  inputVal: string | undefined,
  field: FieldDef,
): PartialConditionResult {
  if (inputVal === undefined || inputVal === '') {
    return 'unknown';
  }
  return cellMatches(cell, inputVal, field) ? 'satisfied' : 'failed';
}

function cellMatches(cell: Cell, inputVal: string, field: FieldDef): boolean {
  const { op, val } = cell;
  const a = coerce(inputVal, field.type);

  if (op === 'null') return a === null;
  if (a === null) return false;

  if (op === 'between' && Array.isArray(val)) {
    const lo = coerce(val[0] ?? null, field.type);
    const hi = coerce(val[1] ?? null, field.type);
    if (lo === null || hi === null) return false;
    if ((cmp(lo) as number) > (cmp(hi) as number)) return false;
    return (
      (cmp(lo) as number) <= (cmp(a) as number) &&
      (cmp(a) as number) <= (cmp(hi) as number)
    );
  }

  if (op === 'in' && Array.isArray(val)) {
    const bs = val.map((v) => coerce(v, field.type)).filter((b) => b !== null);
    if (bs.length === 0) return false;
    return bs.some((b) => cmp(a) === cmp(b));
  }

  if (op === 'before_today')
    return (cmp(a) as number) < (cmp(today()) as number);
  if (op === 'today_or_before')
    return (cmp(a) as number) <= (cmp(today()) as number);
  if (op === 'after_today')
    return (cmp(a) as number) > (cmp(today()) as number);
  if (op === 'today_or_after')
    return (cmp(a) as number) >= (cmp(today()) as number);

  const b = coerce(typeof val === 'string' ? val : null, field.type);
  if (b === null) return false;

  const ca = cmp(a);
  const cb = cmp(b);
  switch (op) {
    case '=':
      return ca === cb;
    case '!=':
      return ca !== cb;
    case '<':
      return (ca as number) < (cb as number);
    case '<=':
      return (ca as number) <= (cb as number);
    case '>':
      return (ca as number) > (cb as number);
    case '>=':
      return (ca as number) >= (cb as number);
    case 'contains':
      return String(a).includes(String(b));
    case 'starts_with':
      return String(a).startsWith(String(b));
    case 'ends_with':
      return String(a).endsWith(String(b));
    default:
      return false;
  }
}

function buildOutcomes(
  candidates: PathCandidate[],
): WorkspaceOutcomeCandidate[] {
  const seen = new Map<string, WorkspaceOutcomeCandidate>();
  for (const candidate of candidates) {
    if (!candidate.outputs) continue;
    const key = stableOutputsKey(candidate.outputs);
    const label = Object.values(candidate.outputs).filter(Boolean).join(' / ');
    const existing = seen.get(key);
    if (existing) {
      existing.certainty =
        existing.certainty === 'definite' || candidate.certainty === 'definite'
          ? 'definite'
          : 'possible';
      continue;
    }
    seen.set(key, {
      key,
      label: label || 'Matched result',
      outputs: candidate.outputs,
      certainty: candidate.certainty,
    });
  }
  return Array.from(seen.values());
}

function equivalentOutputs(
  candidates: PathCandidate[],
): Record<string, string> | undefined {
  if (candidates.length === 0) return undefined;
  const first = candidates[0]?.outputs;
  if (!first) return undefined;
  const firstKey = stableOutputsKey(first);
  return candidates.every(
    (candidate) =>
      candidate.outputs && stableOutputsKey(candidate.outputs) === firstKey,
  )
    ? first
    : undefined;
}

function selectRecommendedChecks(
  logic: Logic,
  missingFieldIds: string[],
  candidates: PathCandidate[],
  config?: WorkspaceConfig,
): WorkspaceRecommendedCheck[] {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const fieldId of candidate.missingFieldIds) {
      counts.set(fieldId, (counts.get(fieldId) ?? 0) + 1);
    }
  }

  const sorted = [...missingFieldIds].sort((a, b) => {
    const aConfig = config?.fields?.[a];
    const bConfig = config?.fields?.[b];
    const orderDiff =
      (aConfig?.askOrder ?? Number.MAX_SAFE_INTEGER) -
      (bConfig?.askOrder ?? Number.MAX_SAFE_INTEGER);
    if (orderDiff !== 0) return orderDiff;
    const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;
    return fieldIndex(logic, a) - fieldIndex(logic, b);
  });

  const first = sorted[0];
  if (!first) return [];

  const groupId = config?.fields?.[first]?.groupId;
  const fieldIds =
    groupId === undefined
      ? [first]
      : sorted
          .filter((fieldId) => config?.fields?.[fieldId]?.groupId === groupId)
          .slice(0, 4);

  return [
    {
      fieldIds,
      groupId,
      priority: 1,
      reason:
        fieldIds.length === 1
          ? 'This check is the next most useful fact for the decision.'
          : 'These related checks are the next most useful facts for the decision.',
    },
  ];
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function unionSets<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

function stableOutputsKey(outputs: Record<string, string>): string {
  return Object.entries(outputs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function resultTemplateMatches(
  logic: Logic,
  outputs: Record<string, string>,
  template: WorkspaceResultTemplate,
): boolean {
  const outputsByName = Object.fromEntries(
    Object.entries(outputs).map(([outputId, value]) => [
      outputName(logic, outputId),
      value,
    ]),
  );
  const match = template.match;

  if (match.outputValuesByColumnId) {
    return Object.entries(match.outputValuesByColumnId).every(
      ([outputId, value]) => outputs[outputId] === value,
    );
  }

  if (match.outputValues) {
    return Object.entries(match.outputValues).every(
      ([name, value]) => outputsByName[name] === value,
    );
  }

  const matchedValue =
    match.outputColumnId !== undefined
      ? outputs[match.outputColumnId]
      : match.outputName !== undefined
        ? outputsByName[match.outputName]
        : undefined;

  if (match.outputValue !== undefined) {
    return matchedValue === match.outputValue;
  }

  return matchedValue !== undefined;
}

function buildTemplateContext(
  logic: Logic,
  outputs: Record<string, string>,
  outputsByName: Record<string, string>,
  values: Record<string, WorkspaceValueState>,
): Record<string, string> {
  const context: Record<string, string> = {};

  for (const [outputId, value] of Object.entries(outputs)) {
    context[`output:${outputId}`] = value;
    context[`output:${outputName(logic, outputId)}`] = value;
    context[outputName(logic, outputId)] = value;
  }

  for (const [name, value] of Object.entries(outputsByName)) {
    context[`output:${name}`] = value;
    context[name] = value;
  }

  for (const [fieldId, value] of Object.entries(values)) {
    const field = logic.fieldDefs[fieldId];
    if (!field) continue;
    context[`field:${fieldId}`] = value.value;
    context[`field:${field.name}`] = value.value;
    context[field.name] = value.value;
  }

  return context;
}

function renderTemplate(
  template: string | undefined,
  context: Record<string, string>,
): string | undefined {
  if (!template) return undefined;
  const rendered = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    const lookup = String(key).trim();
    return context[lookup] ?? '';
  });
  return rendered.trim() || undefined;
}

function outputByNormalizedName(
  outputsByName: Record<string, string>,
  normalized: string,
): string | undefined {
  return Object.entries(outputsByName).find(
    ([name]) => normalizeKey(name) === normalizeKey(normalized),
  )?.[1];
}

export function outputName(logic: Logic, outputId: string): string {
  for (const table of Object.values(logic.tables)) {
    const output = table.outputCols.find((col) => col.id === outputId);
    if (output) return output.name;
  }
  return outputId;
}

function fieldIndex(logic: Logic, fieldId: string): number {
  return Object.keys(logic.fieldDefs).indexOf(fieldId);
}
