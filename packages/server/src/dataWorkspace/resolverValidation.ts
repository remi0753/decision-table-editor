// Pure validation for resolver recipes (§5.4, WP0/WP3/WP4). DB-free: the route
// gathers the fact catalog (and, for reference tables, the active table's
// columns) then calls this. Three operation kinds are supported:
//   reference_table_lookup — CSV/policy table copied into LEVERIE
//   db_query               — read-only parameterized SELECT against an external DB
//   http_operation         — read-only HTTP/OpenAPI GET against an external API

import { assertReadOnlyQuery } from '../connectors/database.js';
import type {
  KeyColumnMapping,
  Normalizer,
  OperationRef,
  OutputMapping,
  ParameterBinding,
} from '../resolvers/types.js';

export const RESOLVER_FALLBACK_POLICIES = [
  'ask_operator',
  'mark_unavailable',
  'block',
] as const;
export type ResolverFallbackPolicy =
  (typeof RESOLVER_FALLBACK_POLICIES)[number];

export const SUPPORTED_OPERATION_KINDS = [
  'reference_table_lookup',
  'db_query',
  'http_operation',
] as const;

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
  // For reference_table_lookup only: the active reference table's columns.
  tableKeyColumns?: string[];
  tableColumns?: string[];
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

type Fail = { ok: false; error: ResolverValidationError };
type Ok = { ok: true; value: NormalizedResolverRecipe };

function err(code: string, message: string): Fail {
  return { ok: false, error: { code, message } };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

// Validate a list of {name, factId} parameter bindings against the input facts.
function parseParams(
  raw: unknown,
  inputFactIds: string[],
): { ok: true; value: ParameterBinding[] } | Fail {
  if (!Array.isArray(raw) || raw.length === 0) {
    return err('params_required', 'operationRef.params must be non-empty.');
  }
  const params: ParameterBinding[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const name = (entry as { name?: unknown }).name;
    const factId = (entry as { factId?: unknown }).factId;
    if (typeof name !== 'string' || !name || typeof factId !== 'string') {
      return err('invalid_param', 'Each param needs a name and a factId.');
    }
    if (seen.has(name)) {
      return err('duplicate_param', `Parameter "${name}" is repeated.`);
    }
    if (!inputFactIds.includes(factId)) {
      return err(
        'param_not_input',
        `Parameter "${name}" maps to a fact not in inputFactIds.`,
      );
    }
    seen.add(name);
    params.push({ name, factId });
  }
  return { ok: true, value: params };
}

// Validate output mappings against the fact catalog. For reference tables the
// columnName must be a real table column; for live sources it is the source
// field/response path, so only the fact is checked.
function parseOutputMappings(
  raw: unknown,
  ctx: ResolverValidationContext,
  checkTableColumns: boolean,
): { ok: true; value: OutputMapping[] } | Fail {
  if (!Array.isArray(raw) || raw.length === 0) {
    return err('output_mappings_required', 'outputMappings must be non-empty.');
  }
  const outputMappings: OutputMapping[] = [];
  const seenFacts = new Set<string>();
  for (const entry of raw) {
    const columnName = (entry as { columnName?: unknown }).columnName;
    const factId = (entry as { factId?: unknown }).factId;
    const normalizer = (entry as { normalizer?: Normalizer }).normalizer;
    if (typeof columnName !== 'string' || typeof factId !== 'string') {
      return err(
        'invalid_output_mapping',
        'Each output mapping needs columnName and factId.',
      );
    }
    if (checkTableColumns && !(ctx.tableColumns ?? []).includes(columnName)) {
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
    if (seenFacts.has(factId)) {
      return err(
        'duplicate_output_fact',
        `Fact "${factId}" is mapped by more than one output.`,
      );
    }
    seenFacts.add(factId);
    outputMappings.push({ columnName, factId, normalizer });
  }
  return { ok: true, value: outputMappings };
}

export function validateResolverRecipe(
  body: ResolverRecipeDraft,
  ctx: ResolverValidationContext,
): Ok | Fail {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    return err('invalid_name', 'A recipe name (max 120) is required.');
  }

  const op = body.operationRef as { kind?: unknown } | null | undefined;
  const opKind = op && typeof op === 'object' ? op.kind : undefined;
  if (
    typeof opKind !== 'string' ||
    !SUPPORTED_OPERATION_KINDS.includes(
      opKind as (typeof SUPPORTED_OPERATION_KINDS)[number],
    )
  ) {
    return err(
      'unsupported_operation',
      `operationRef.kind must be one of: ${SUPPORTED_OPERATION_KINDS.join(', ')}.`,
    );
  }

  // input_fact_ids — non-empty, all active, at least one key fact (shared).
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

  const fallbackPolicy = parseFallback(body.fallbackPolicy);
  if ('error' in fallbackPolicy) return fallbackPolicy;
  const normalizers = parseNormalizers(body.normalizers);

  // opKind validated above implies op is a non-null object.
  const opObj = op as Record<string, unknown>;
  if (opKind === 'reference_table_lookup') {
    return validateReferenceTable(
      body,
      ctx,
      inputFactIds,
      fallbackPolicy.value,
      normalizers,
    );
  }
  if (opKind === 'db_query') {
    return validateDbQuery(
      opObj,
      body,
      ctx,
      inputFactIds,
      fallbackPolicy.value,
      normalizers,
    );
  }
  return validateHttp(
    opObj,
    body,
    ctx,
    inputFactIds,
    fallbackPolicy.value,
    normalizers,
  );
}

function parseFallback(raw: unknown): { value: ResolverFallbackPolicy } | Fail {
  if (raw === undefined) return { value: 'ask_operator' };
  if (
    typeof raw !== 'string' ||
    !RESOLVER_FALLBACK_POLICIES.includes(raw as ResolverFallbackPolicy)
  ) {
    return err('invalid_fallback_policy', 'fallbackPolicy is invalid.');
  }
  return { value: raw as ResolverFallbackPolicy };
}

function parseNormalizers(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function validateReferenceTable(
  body: ResolverRecipeDraft,
  ctx: ResolverValidationContext,
  inputFactIds: string[],
  fallbackPolicy: ResolverFallbackPolicy,
  normalizers: Record<string, unknown>,
): Ok | Fail {
  const tableKeyColumns = ctx.tableKeyColumns ?? [];
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
  const mapped = new Set<string>();
  for (const entry of rawKeyCols) {
    const columnName = (entry as { columnName?: unknown }).columnName;
    const factId = (entry as { factId?: unknown }).factId;
    if (typeof columnName !== 'string' || typeof factId !== 'string') {
      return err(
        'invalid_key_mapping',
        'Each key column needs columnName and factId.',
      );
    }
    if (!tableKeyColumns.includes(columnName)) {
      return err(
        'unknown_key_column',
        `"${columnName}" is not a key column of the table.`,
      );
    }
    if (!inputFactIds.includes(factId)) {
      return err(
        'key_fact_not_input',
        `Key column "${columnName}" maps to a non-input fact.`,
      );
    }
    mapped.add(columnName);
    keyColumns.push({ columnName, factId });
  }
  for (const col of tableKeyColumns) {
    if (!mapped.has(col))
      return err('key_column_unmapped', `Key column "${col}" is not mapped.`);
  }
  const out = parseOutputMappings(body.outputMappings, ctx, true);
  if ('error' in out) return out;
  return {
    ok: true,
    value: {
      name: (body.name as string).trim(),
      inputFactIds,
      operationRef: { kind: 'reference_table_lookup' },
      parameterMappings: { keyColumns },
      outputMappings: out.value,
      normalizers,
      fallbackPolicy,
    },
  };
}

function validateDbQuery(
  op: { kind?: unknown; query?: unknown; params?: unknown },
  body: ResolverRecipeDraft,
  ctx: ResolverValidationContext,
  inputFactIds: string[],
  fallbackPolicy: ResolverFallbackPolicy,
  normalizers: Record<string, unknown>,
): Ok | Fail {
  if (typeof op.query !== 'string' || !op.query.trim()) {
    return err('query_required', 'operationRef.query is required.');
  }
  try {
    assertReadOnlyQuery(op.query);
  } catch (e) {
    return err(
      'unsafe_query',
      e instanceof Error ? e.message : 'Unsafe query.',
    );
  }
  const params = parseParams(op.params, inputFactIds);
  if ('error' in params) return params;
  const out = parseOutputMappings(body.outputMappings, ctx, false);
  if ('error' in out) return out;
  return {
    ok: true,
    value: {
      name: (body.name as string).trim(),
      inputFactIds,
      operationRef: { kind: 'db_query', query: op.query, params: params.value },
      parameterMappings: { keyColumns: [] },
      outputMappings: out.value,
      normalizers,
      fallbackPolicy,
    },
  };
}

function validateHttp(
  op: {
    kind?: unknown;
    method?: unknown;
    urlTemplate?: unknown;
    params?: unknown;
    recordPath?: unknown;
  },
  body: ResolverRecipeDraft,
  ctx: ResolverValidationContext,
  inputFactIds: string[],
  fallbackPolicy: ResolverFallbackPolicy,
  normalizers: Record<string, unknown>,
): Ok | Fail {
  if (op.method !== undefined && op.method !== 'GET') {
    return err('unsupported_method', 'Only GET http operations are supported.');
  }
  if (
    typeof op.urlTemplate !== 'string' ||
    !/^https?:\/\//i.test(op.urlTemplate)
  ) {
    return err(
      'invalid_url_template',
      'operationRef.urlTemplate must be an http(s) URL.',
    );
  }
  if (op.recordPath !== undefined && typeof op.recordPath !== 'string') {
    return err('invalid_record_path', 'recordPath must be a string.');
  }
  const params = parseParams(op.params, inputFactIds);
  if ('error' in params) return params;
  const out = parseOutputMappings(body.outputMappings, ctx, false);
  if ('error' in out) return out;
  return {
    ok: true,
    value: {
      name: (body.name as string).trim(),
      inputFactIds,
      operationRef: {
        kind: 'http_operation',
        method: 'GET',
        urlTemplate: op.urlTemplate,
        params: params.value,
        recordPath:
          typeof op.recordPath === 'string' ? op.recordPath : undefined,
      },
      parameterMappings: { keyColumns: [] },
      outputMappings: out.value,
      normalizers,
      fallbackPolicy,
    },
  };
}
