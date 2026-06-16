// Pure validation helpers for the Fact Catalog API (Slice A,
// implementation_leverie_data_connected_workspace.md §5.1). Kept free of any DB
// or Hono dependency so they can be unit-tested directly. Cross-row checks that
// genuinely need the database (workspace-wide alias/name uniqueness) stay in the
// route layer; everything expressible from a single payload lives here.

import type { FieldDef } from '@leverie/engine';

export const FACT_TYPES = [
  'string',
  'number',
  'bool',
  'enum',
  'date',
  'datetime',
] as const;
export type FactType = (typeof FACT_TYPES)[number];

export const FACT_KINDS = [
  'key',
  'system_fact',
  'manual_fact',
  'derived_fact',
  'internal_fact',
] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const FACT_STATUSES = ['draft', 'active', 'deprecated'] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const FACT_LOGGING_POLICIES = [
  'full',
  'masked',
  'hash',
  'omit',
] as const;
export type FactLoggingPolicy = (typeof FACT_LOGGING_POLICIES)[number];

export const MAX_FACT_NAME_LENGTH = 120;
export const MAX_FACT_DESCRIPTION_LENGTH = 1000;
export const MAX_FACT_ALIASES = 50;
export const MAX_FACT_ALIAS_LENGTH = 120;

export interface FactValidationError {
  code: string;
  message: string;
}

// Normalize an alias for duplicate comparison: trimmed + case-folded. The
// stored alias keeps its trimmed original casing; only the comparison key is
// folded so "Order ID" and "order id" collide.
export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

// Validate and normalize an alias array. Rejects non-arrays, oversized lists,
// non-string / oversized / blank entries, and duplicates after normalization
// WITHIN the submitted list. Workspace-wide duplicate detection (across other
// facts) needs the DB and is done in the route. Returns the trimmed aliases in
// input order with blanks removed.
export function validateAliases(
  raw: unknown,
): { ok: true; aliases: string[] } | { ok: false; error: FactValidationError } {
  if (raw === undefined || raw === null) return { ok: true, aliases: [] };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      error: { code: 'invalid_aliases', message: 'aliases must be an array.' },
    };
  }
  if (raw.length > MAX_FACT_ALIASES) {
    return {
      ok: false,
      error: {
        code: 'too_many_aliases',
        message: `A fact can have at most ${MAX_FACT_ALIASES} aliases.`,
      },
    };
  }

  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      return {
        ok: false,
        error: {
          code: 'invalid_alias',
          message: 'Each alias must be a string.',
        },
      };
    }
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_FACT_ALIAS_LENGTH) {
      return {
        ok: false,
        error: {
          code: 'alias_too_long',
          message: `Each alias must be at most ${MAX_FACT_ALIAS_LENGTH} characters.`,
        },
      };
    }
    const key = normalizeAlias(trimmed);
    if (seen.has(key)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_alias',
          message: `Duplicate alias: "${trimmed}".`,
        },
      };
    }
    seen.add(key);
    aliases.push(trimmed);
  }
  return { ok: true, aliases };
}

// Validate and normalize enum values for an enum fact. Non-enum facts must not
// carry enum values. Mirrors the DB CHECK (non-empty array of strings).
export function validateEnumValues(
  type: FactType,
  raw: unknown,
):
  | { ok: true; enumValues: string[] | null }
  | { ok: false; error: FactValidationError } {
  if (type !== 'enum') {
    // Tolerate an explicitly empty array / null for non-enum facts.
    if (raw === undefined || raw === null)
      return { ok: true, enumValues: null };
    if (Array.isArray(raw) && raw.length === 0)
      return { ok: true, enumValues: null };
    return {
      ok: false,
      error: {
        code: 'enum_values_not_allowed',
        message: 'Only enum facts can define enum values.',
      },
    };
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      ok: false,
      error: {
        code: 'enum_values_required',
        message: 'Enum facts require at least one enum value.',
      },
    };
  }

  const values: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return {
        ok: false,
        error: {
          code: 'invalid_enum_value',
          message: 'Each enum value must be a non-empty string.',
        },
      };
    }
    const trimmed = entry.trim();
    if (seen.has(trimmed)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_enum_value',
          message: `Duplicate enum value: "${trimmed}".`,
        },
      };
    }
    seen.add(trimmed);
    values.push(trimmed);
  }
  return { ok: true, enumValues: values };
}

export interface NormalizedFactInput {
  name: string;
  description: string | null;
  type: FactType;
  kind: FactKind;
  enumValues: string[] | null;
  aliases: string[];
  question: string | null;
  sensitive: boolean;
  loggingPolicy: FactLoggingPolicy;
  retentionPolicy: string;
  status: FactStatus;
}

export const FACT_RETENTION_POLICIES = [
  'workspace_default',
  'no_store',
] as const;

export interface FactInputDraft {
  name?: unknown;
  description?: unknown;
  type?: unknown;
  kind?: unknown;
  enumValues?: unknown;
  aliases?: unknown;
  question?: unknown;
  sensitive?: unknown;
  loggingPolicy?: unknown;
  retentionPolicy?: unknown;
  status?: unknown;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

// Validate a complete fact-create payload into a normalized shape. Used by the
// create route. PATCH validates field-by-field via the smaller helpers above.
export function validateFactCreate(
  body: FactInputDraft,
):
  | { ok: true; value: NormalizedFactInput }
  | { ok: false; error: FactValidationError } {
  const name = isString(body.name) ? body.name.trim() : '';
  if (!name) {
    return {
      ok: false,
      error: { code: 'invalid_name', message: 'name is required.' },
    };
  }
  if (name.length > MAX_FACT_NAME_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'name_too_long',
        message: `name must be at most ${MAX_FACT_NAME_LENGTH} characters.`,
      },
    };
  }

  let description: string | null = null;
  if (body.description !== undefined && body.description !== null) {
    if (!isString(body.description)) {
      return {
        ok: false,
        error: {
          code: 'invalid_description',
          message: 'description must be a string.',
        },
      };
    }
    const trimmed = body.description.trim();
    if (trimmed.length > MAX_FACT_DESCRIPTION_LENGTH) {
      return {
        ok: false,
        error: {
          code: 'description_too_long',
          message: `description must be at most ${MAX_FACT_DESCRIPTION_LENGTH} characters.`,
        },
      };
    }
    description = trimmed || null;
  }

  if (!isString(body.type) || !FACT_TYPES.includes(body.type as FactType)) {
    return {
      ok: false,
      error: { code: 'invalid_type', message: 'type is invalid.' },
    };
  }
  const type = body.type as FactType;

  if (!isString(body.kind) || !FACT_KINDS.includes(body.kind as FactKind)) {
    return {
      ok: false,
      error: { code: 'invalid_kind', message: 'kind is invalid.' },
    };
  }
  const kind = body.kind as FactKind;
  // derived_fact is reserved in the MVP: there is no derived-fact computation
  // engine yet, so the routes must not create one (§3.1, §4.1, §3.6).
  if (kind === 'derived_fact') {
    return {
      ok: false,
      error: {
        code: 'derived_fact_unsupported',
        message:
          'derived_fact is reserved and cannot be created in the current MVP.',
      },
    };
  }

  const enumResult = validateEnumValues(type, body.enumValues);
  if (!enumResult.ok) return enumResult;

  const aliasResult = validateAliases(body.aliases);
  if (!aliasResult.ok) return aliasResult;

  let status: FactStatus = 'active';
  if (body.status !== undefined) {
    if (
      !isString(body.status) ||
      !FACT_STATUSES.includes(body.status as FactStatus)
    ) {
      return {
        ok: false,
        error: { code: 'invalid_status', message: 'status is invalid.' },
      };
    }
    status = body.status as FactStatus;
  }

  let question: string | null = null;
  if (body.question !== undefined && body.question !== null) {
    if (!isString(body.question)) {
      return {
        ok: false,
        error: {
          code: 'invalid_question',
          message: 'question must be a string.',
        },
      };
    }
    question = body.question.trim() || null;
  }
  // Active manual facts require a question (mirrors the DB CHECK).
  if (kind === 'manual_fact' && status === 'active' && !question) {
    return {
      ok: false,
      error: {
        code: 'question_required',
        message: 'Active manual facts require a question.',
      },
    };
  }

  let loggingPolicy: FactLoggingPolicy = 'full';
  if (body.loggingPolicy !== undefined) {
    if (
      !isString(body.loggingPolicy) ||
      !FACT_LOGGING_POLICIES.includes(body.loggingPolicy as FactLoggingPolicy)
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_logging_policy',
          message: 'loggingPolicy is invalid.',
        },
      };
    }
    loggingPolicy = body.loggingPolicy as FactLoggingPolicy;
  }

  const sensitive =
    typeof body.sensitive === 'boolean' ? body.sensitive : false;
  // Sensitive facts default to masked logging; full logging needs an explicit
  // admin/owner choice, enforced in the route. Here we only default the policy
  // when sensitive and none was supplied.
  if (sensitive && body.loggingPolicy === undefined) {
    loggingPolicy = 'masked';
  }

  // Retention policy. Sensitive facts default to no_store (data minimization,
  // WP0): used for evaluation, never persisted on the decision record.
  let retentionPolicy = sensitive ? 'no_store' : 'workspace_default';
  if (body.retentionPolicy !== undefined) {
    if (
      !isString(body.retentionPolicy) ||
      !FACT_RETENTION_POLICIES.includes(
        body.retentionPolicy as (typeof FACT_RETENTION_POLICIES)[number],
      )
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_retention_policy',
          message: 'retentionPolicy is invalid.',
        },
      };
    }
    retentionPolicy = body.retentionPolicy;
  }

  return {
    ok: true,
    value: {
      name,
      description,
      type,
      kind,
      enumValues: enumResult.enumValues,
      aliases: aliasResult.aliases,
      question,
      sensitive,
      loggingPolicy,
      retentionPolicy,
      status,
    },
  };
}

// ── Binding validation (§5.2) ─────────────────────────────────────────────────

export interface BindingFactView {
  id: string;
  type: FactType;
  status: FactStatus;
  enumValues: string[] | null;
}

export interface BindingInput {
  fieldId: string;
  factId: string;
}

// Validate a full binding list against the logic's field defs and the
// workspace fact catalog. Rejects: unknown fields/facts, deprecated facts,
// type mismatch, enum mismatch (the fact enum must be a superset of the field
// enum), and duplicate field/fact entries (MVP: one fact per field, one field
// per fact). Returns the validated bindings on success.
export function validateBindings(
  fieldDefs: Record<string, FieldDef>,
  facts: BindingFactView[],
  rawBindings: unknown,
):
  | { ok: true; bindings: BindingInput[] }
  | { ok: false; error: FactValidationError } {
  if (!Array.isArray(rawBindings)) {
    return {
      ok: false,
      error: {
        code: 'invalid_bindings',
        message: 'bindings must be an array.',
      },
    };
  }

  const factById = new Map<string, BindingFactView>();
  for (const fact of facts) factById.set(fact.id, fact);

  const bindings: BindingInput[] = [];
  const seenFields = new Set<string>();
  const seenFacts = new Set<string>();

  for (const entry of rawBindings) {
    if (!entry || typeof entry !== 'object') {
      return {
        ok: false,
        error: {
          code: 'invalid_binding',
          message: 'Each binding must be an object.',
        },
      };
    }
    const fieldId = (entry as { fieldId?: unknown }).fieldId;
    const factId = (entry as { factId?: unknown }).factId;
    if (!isString(fieldId) || !isString(factId)) {
      return {
        ok: false,
        error: {
          code: 'invalid_binding',
          message: 'Each binding needs a fieldId and factId.',
        },
      };
    }

    const field = fieldDefs[fieldId];
    if (!field) {
      return {
        ok: false,
        error: {
          code: 'unknown_field',
          message: `Field "${fieldId}" does not exist in this logic.`,
        },
      };
    }
    const fact = factById.get(factId);
    if (!fact) {
      return {
        ok: false,
        error: {
          code: 'unknown_fact',
          message: `Fact "${factId}" does not exist in this workspace.`,
        },
      };
    }
    if (fact.status === 'deprecated') {
      return {
        ok: false,
        error: {
          code: 'deprecated_fact',
          message: `Fact "${factId}" is deprecated and cannot be bound.`,
        },
      };
    }
    if (seenFields.has(fieldId)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_field_binding',
          message: `Field "${fieldId}" is bound more than once.`,
        },
      };
    }
    if (seenFacts.has(factId)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_fact_binding',
          message: `Fact "${factId}" is bound more than once.`,
        },
      };
    }
    if (field.type !== fact.type) {
      return {
        ok: false,
        error: {
          code: 'type_mismatch',
          message: `Field "${fieldId}" type (${field.type}) does not match fact type (${fact.type}).`,
        },
      };
    }
    // Enum compatibility: the fact's enum must be a superset of the field's
    // enum so every value the engine can produce is a valid fact value.
    if (field.type === 'enum') {
      const fieldEnum = field.enumValues ?? [];
      const factEnum = new Set(fact.enumValues ?? []);
      for (const value of fieldEnum) {
        if (!factEnum.has(value)) {
          return {
            ok: false,
            error: {
              code: 'enum_mismatch',
              message: `Field "${fieldId}" enum value "${value}" is not present in the fact enum.`,
            },
          };
        }
      }
    }

    seenFields.add(fieldId);
    seenFacts.add(factId);
    bindings.push({ fieldId, factId });
  }

  return { ok: true, bindings };
}
