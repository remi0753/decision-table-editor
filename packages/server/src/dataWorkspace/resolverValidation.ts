// Pure validation for resolver recipes (§5.4). DB-free: the route gathers the
// fact catalog and the active reference table, then calls this with that
// context. MVP supports only reference_table_lookup.

import type {
  KeyColumnMapping,
  Normalizer,
  OperationRef,
  OutputMapping,
} from '../resolvers/types.js';

export const RESOLVER_FALLBACK_POLICIES = [
  'ask_operator',
  'mark_unavailable',
  'block',
] as const;
export type ResolverFallbackPolicy =
  (typeof RESOLVER_FALLBACK_POLICIES)[number];

export interface ResolverValidationError {
  code: string;
  message: string;
}

export interface ResolverFactView {
  kind: string;
  status: string;
}

export interface ResolverValidationContext {
  // facts in the workspace, by id
  facts: Map<string, ResolverFactView>;
  // active reference table for the recipe's data source
  tableKeyColumns: string[];
  tableColumns: string[];
}

export interface NormalizedResolverRecipe {
  name: string;
  inputFactIds: string[];
  operationRef: OperationRef;
  parameterMappings: { keyColumns: KeyColumnMapping[] };
  outputMappings: OutputMapping[];
  normalizers: Record<string, unknown>;
  fallbackPolicy: ResolverFallbackPolicy;
}

export interface ResolverRecipeDraft {
  name?: unknown;
  inputFactIds?: unknown;
  operationRef?: unknown;
  parameterMappings?: unknown;
  outputMappings?: unknown;
  normalizers?: unknown;
  fallbackPolicy?: unknown;
}

function err(
  code: string,
  message: string,
): { ok: false; error: ResolverValidationError } {
  return { ok: false, error: { code, message } };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function validateResolverRecipe(
  body: ResolverRecipeDraft,
  ctx: ResolverValidationContext,
):
  | { ok: true; value: NormalizedResolverRecipe }
  | { ok: false; error: ResolverValidationError } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    return err('invalid_name', 'A recipe name (max 120) is required.');
  }

  // operation_ref — only reference_table_lookup in the MVP.
  const op = body.operationRef;
  if (
    !op ||
    typeof op !== 'object' ||
    (op as { kind?: unknown }).kind !== 'reference_table_lookup'
  ) {
    return err(
      'unsupported_operation',
      'Only reference_table_lookup is supported.',
    );
  }

  // input_fact_ids — non-empty, all active, at least one key fact.
  if (!isStringArray(body.inputFactIds) || body.inputFactIds.length === 0) {
    return err(
      'input_facts_required',
      'inputFactIds must be a non-empty array.',
    );
  }
  let hasKey = false;
  for (const id of body.inputFactIds) {
    const fact = ctx.facts.get(id);
    if (!fact || fact.status !== 'active') {
      return err('unknown_input_fact', `Input fact "${id}" is not active.`);
    }
    if (fact.kind === 'key') hasKey = true;
  }
  if (!hasKey) {
    return err('key_fact_required', 'At least one input fact must be a key.');
  }
  const inputFactIds = [...body.inputFactIds];

  // parameter_mappings.keyColumns — cover every table key column, each mapped to
  // an input fact, in the table's key set.
  const pm = body.parameterMappings as
    | { keyColumns?: unknown }
    | null
    | undefined;
  const rawKeyCols = pm?.keyColumns;
  if (!Array.isArray(rawKeyCols) || rawKeyCols.length === 0) {
    return err(
      'key_columns_required',
      'parameterMappings.keyColumns is required.',
    );
  }
  const keyColumns: KeyColumnMapping[] = [];
  const mappedColumns = new Set<string>();
  for (const entry of rawKeyCols) {
    const columnName = (entry as { columnName?: unknown }).columnName;
    const factId = (entry as { factId?: unknown }).factId;
    if (typeof columnName !== 'string' || typeof factId !== 'string') {
      return err(
        'invalid_key_mapping',
        'Each key column needs columnName and factId.',
      );
    }
    if (!ctx.tableKeyColumns.includes(columnName)) {
      return err(
        'unknown_key_column',
        `"${columnName}" is not a key column of the table.`,
      );
    }
    if (!inputFactIds.includes(factId)) {
      return err(
        'key_fact_not_input',
        `Key column "${columnName}" maps to a fact not in inputFactIds.`,
      );
    }
    mappedColumns.add(columnName);
    keyColumns.push({ columnName, factId });
  }
  for (const col of ctx.tableKeyColumns) {
    if (!mappedColumns.has(col)) {
      return err('key_column_unmapped', `Key column "${col}" is not mapped.`);
    }
  }

  // output_mappings — map table columns to active facts; distinct facts.
  if (!Array.isArray(body.outputMappings) || body.outputMappings.length === 0) {
    return err(
      'output_mappings_required',
      'outputMappings must be a non-empty array.',
    );
  }
  const outputMappings: OutputMapping[] = [];
  const seenOutFacts = new Set<string>();
  for (const entry of body.outputMappings) {
    const columnName = (entry as { columnName?: unknown }).columnName;
    const factId = (entry as { factId?: unknown }).factId;
    const normalizer = (entry as { normalizer?: Normalizer }).normalizer;
    if (typeof columnName !== 'string' || typeof factId !== 'string') {
      return err(
        'invalid_output_mapping',
        'Each output mapping needs columnName and factId.',
      );
    }
    if (!ctx.tableColumns.includes(columnName)) {
      return err(
        'unknown_output_column',
        `"${columnName}" is not a column of the table.`,
      );
    }
    const fact = ctx.facts.get(factId);
    if (!fact || fact.status !== 'active') {
      return err(
        'unknown_output_fact',
        `Output fact "${factId}" is not active.`,
      );
    }
    if (seenOutFacts.has(factId)) {
      return err(
        'duplicate_output_fact',
        `Fact "${factId}" is mapped by more than one output.`,
      );
    }
    seenOutFacts.add(factId);
    outputMappings.push({ columnName, factId, normalizer });
  }

  let fallbackPolicy: ResolverFallbackPolicy = 'ask_operator';
  if (body.fallbackPolicy !== undefined) {
    if (
      typeof body.fallbackPolicy !== 'string' ||
      !RESOLVER_FALLBACK_POLICIES.includes(
        body.fallbackPolicy as ResolverFallbackPolicy,
      )
    ) {
      return err('invalid_fallback_policy', 'fallbackPolicy is invalid.');
    }
    fallbackPolicy = body.fallbackPolicy as ResolverFallbackPolicy;
  }

  const normalizers =
    body.normalizers &&
    typeof body.normalizers === 'object' &&
    !Array.isArray(body.normalizers)
      ? (body.normalizers as Record<string, unknown>)
      : {};

  return {
    ok: true,
    value: {
      name,
      inputFactIds,
      operationRef: { kind: 'reference_table_lookup' },
      parameterMappings: { keyColumns },
      outputMappings,
      normalizers,
      fallbackPolicy,
    },
  };
}
