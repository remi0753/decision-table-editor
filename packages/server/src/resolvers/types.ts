// Resolver runtime shared types (Slice B,
// implementation_leverie_data_connected_workspace.md §6). These mirror the
// fact-layer vocabulary in @leverie/ui-runtime but are redeclared here so the
// server package does not depend on the React UI package.

export type FactType =
  | 'string'
  | 'number'
  | 'bool'
  | 'enum'
  | 'date'
  | 'datetime';

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

// Minimal fact view the runtime needs for normalization. Read from the pinned
// snapshot (or the live catalog for test-lookup), never assumed.
export interface FactView {
  id: string;
  type: FactType;
  enumValues?: string[] | null;
}

// Normalizer config attached to an output mapping (§3.6, §6.3). The MVP only
// uses `date`/`datetime` formats and enum mapping, but the shape is open so HTTP
// connectors can add more without a migration.
export interface Normalizer {
  kind?:
    | 'string'
    | 'number'
    | 'currency'
    | 'boolean'
    | 'enum'
    | 'date'
    | 'datetime';
  format?: string;
  // explicit enum value mapping: source value -> canonical fact enum value
  mapping?: Record<string, string>;
}

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

export type NormalizeResult =
  | { ok: true; value: string }
  | { ok: false; state: 'invalid' | 'unavailable'; message: string };

// MVP resolver recipe payload shapes (§3.6).
export interface KeyColumnMapping {
  columnName: string;
  factId: string;
}

export interface ParameterMappings {
  keyColumns: KeyColumnMapping[];
}

export interface OutputMapping {
  columnName: string;
  factId: string;
  normalizer?: Normalizer;
}

export type OutputMappings = OutputMapping[];

export interface OperationRef {
  kind: 'reference_table_lookup';
}
