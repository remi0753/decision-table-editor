// Data-connected workspace shared types and one-directional mapping helpers.
// See implementation_leverie_data_connected_workspace.md §4.
//
// The fact layer is canonical. These helpers project the richer fact-layer
// vocabulary DOWN into the existing field-layer vocabulary from
// workspaceTypes.ts (§4.4). Do NOT invent a third representation in the runner.

import type {
  WorkspaceValueSource,
  WorkspaceValueStatus,
} from './workspaceTypes.js';

// ── §4.1 Fact types ─────────────────────────────────────────────────────────

export type FactType =
  | 'string'
  | 'number'
  | 'bool'
  | 'enum'
  | 'date'
  | 'datetime';

export type FactKind =
  | 'key'
  | 'system_fact'
  | 'manual_fact'
  // 'derived_fact' is part of the union for forward compatibility but is
  // reserved in the MVP: there is no derived-fact computation engine yet, so
  // MVP routes must not create derived facts and publish readiness blocks them
  // (§3.1, §4.1).
  | 'derived_fact'
  | 'internal_fact';

export type FactStatus = 'draft' | 'active' | 'deprecated';

export type FactLoggingPolicy = 'full' | 'masked' | 'hash' | 'omit';

export interface FactDefinition {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  type: FactType;
  enumValues?: string[] | null;
  kind: FactKind;
  aliases: string[];
  question?: string | null;
  sensitive: boolean;
  loggingPolicy: FactLoggingPolicy;
  retentionPolicy: string;
  status: FactStatus;
  version: number;
}

export interface LogicFactBinding {
  fieldId: string;
  factId: string;
}

// ── §4.2 Resolver value types ────────────────────────────────────────────────

export type DecisionFactState =
  | 'missing'
  | 'resolved'
  | 'needs_confirmation'
  | 'confirmed'
  | 'manual'
  | 'unavailable'
  | 'invalid'
  | 'hidden';

export type DecisionFactSourceKind =
  | 'manual'
  | 'url_query'
  | 'clipboard'
  | 'reference_table'
  | 'api'
  | 'derived'
  | 'embed'
  | 'internal';

export interface FactProvenance {
  resolverRecipeId?: string;
  dataSourceId?: string;
  referenceTableId?: string;
  referenceTableVersion?: number;
  sourceColumn?: string;
  retrievedAt?: string;
  confidence?: number;
  evidenceLabel?: string;
}

export interface ResolvedFactValue {
  factId: string;
  fieldId?: string;
  value?: string;
  maskedValue?: string;
  state: DecisionFactState;
  sourceKind: DecisionFactSourceKind;
  provenance: FactProvenance;
}

// ── §4.4 One-directional mapping (fact layer → field layer) ───────────────────

// Source kind: DecisionFactSourceKind → WorkspaceValueSource.
// reference_table maps to 'api' until WorkspaceValueSource gains a dedicated
// 'reference_table' badge; clipboard maps to 'manual' until a clipboard badge
// exists. The rest map 1:1.
export function factSourceToWorkspaceSource(
  source: DecisionFactSourceKind,
): WorkspaceValueSource {
  switch (source) {
    case 'reference_table':
      return 'api';
    case 'clipboard':
      return 'manual';
    case 'manual':
    case 'url_query':
    case 'embed':
    case 'api':
    case 'derived':
    case 'internal':
      return source;
    default: {
      // Exhaustiveness guard: a new DecisionFactSourceKind must be mapped here.
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

// State: DecisionFactState → WorkspaceValueStatus.
// resolved | manual | confirmed → known (the richer fact state is kept on the
// fact value itself for the fact sheet). unavailable → missing. hidden is a
// display concern; the underlying value still projects, so we treat it as known
// and let the runtime grouping mark it non-displayable. The rest map 1:1.
export function factStateToWorkspaceStatus(
  state: DecisionFactState,
): WorkspaceValueStatus {
  switch (state) {
    case 'resolved':
    case 'manual':
    case 'confirmed':
    case 'hidden':
      return 'known';
    case 'unavailable':
      return 'missing';
    case 'missing':
    case 'needs_confirmation':
    case 'invalid':
      return state;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

// Aliases: fact.aliases is canonical. Derive the field-keyed alias map that
// WorkspacePrefillConfig.acceptedAliases / normalizeWorkspaceInputs already
// consume, by projecting fact aliases through the bindings (§4.4 rule 3). This
// avoids maintaining two alias systems by hand.
export function buildFieldAliasMap(
  facts: Pick<FactDefinition, 'id' | 'aliases'>[],
  bindings: LogicFactBinding[],
): Record<string, string[]> {
  const aliasesByFactId = new Map<string, string[]>();
  for (const fact of facts) aliasesByFactId.set(fact.id, fact.aliases);

  const map: Record<string, string[]> = {};
  for (const binding of bindings) {
    const aliases = aliasesByFactId.get(binding.factId);
    if (aliases && aliases.length > 0) map[binding.fieldId] = [...aliases];
  }
  return map;
}
