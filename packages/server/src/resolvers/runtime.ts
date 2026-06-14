// Resolver runtime orchestration (§6.1, §6.4). The reference-table resolver is
// the only kind in the MVP. The DB row fetch is injected so this stays unit
// testable without a database.

import { buildLookupKeyHash, projectRow } from './referenceTable.js';
import type {
  FactView,
  KeyColumnMapping,
  OutputMapping,
  ResolvedFactValue,
} from './types.js';

export interface ReferenceTableResolverInput {
  recipeId?: string;
  dataSourceId: string;
  referenceTableId: string;
  referenceTableVersion: number;
  keyColumns: string[]; // table key columns, canonical order
  parameterKeyMappings: KeyColumnMapping[]; // factId -> columnName
  outputMappings: OutputMapping[];
  availableFacts: Map<string, string>; // factId -> value
  factsById: Map<string, FactView>;
  fetchRowByHash: (
    referenceTableId: string,
    keyHash: string,
  ) => Promise<Record<string, unknown> | null>;
  now: Date;
}

export interface ReferenceTableResolverResult {
  matched: boolean;
  values: ResolvedFactValue[];
  missingKeys: string[];
}

// Resolve facts from a reference table for one recipe. Builds the key from the
// available input facts via the parameter mappings, hashes it in the table's
// key-column order, fetches the matched row, and projects the output columns.
export async function resolveReferenceTableRecipe(
  input: ReferenceTableResolverInput,
): Promise<ReferenceTableResolverResult> {
  const valuesByColumn: Record<string, string | undefined> = {};
  for (const mapping of input.parameterKeyMappings) {
    valuesByColumn[mapping.columnName] = input.availableFacts.get(
      mapping.factId,
    );
  }

  const hashResult = await buildLookupKeyHash(input.keyColumns, valuesByColumn);
  if (!hashResult.ok) {
    return { matched: false, values: [], missingKeys: hashResult.missing };
  }

  const rowData = await input.fetchRowByHash(
    input.referenceTableId,
    hashResult.hash,
  );
  if (!rowData) {
    return { matched: false, values: [], missingKeys: [] };
  }

  const values = projectRow(rowData, input.outputMappings, input.factsById, {
    resolverRecipeId: input.recipeId,
    dataSourceId: input.dataSourceId,
    referenceTableId: input.referenceTableId,
    referenceTableVersion: input.referenceTableVersion,
    retrievedAt: input.now.toISOString(),
  });

  return { matched: true, values, missingKeys: [] };
}

// ── Multi-recipe orchestration over a published snapshot (§6.1, §6.2) ─────────

export interface SnapshotResolver {
  id: string;
  status: string;
  dataSourceId: string;
  inputFactIds: string[];
  parameterKeyMappings: KeyColumnMapping[];
  outputMappings: OutputMapping[];
}

export interface SnapshotTable {
  dataSourceId: string;
  referenceTableId: string;
  version: number;
  keyColumns: string[];
}

export interface ResolveFactsInput {
  resolvers: SnapshotResolver[];
  tables: SnapshotTable[];
  bindings: { fieldId: string; factId: string }[];
  factsById: Map<string, FactView>;
  availableFacts: Map<string, string>;
  fetchRowByHash: (
    referenceTableId: string,
    keyHash: string,
  ) => Promise<Record<string, unknown> | null>;
  now: Date;
}

export interface ResolveFactsResult {
  values: ResolvedFactValue[];
  unavailable: { factId: string; reason: string }[];
}

// Run every active reference-table resolver in the snapshot whose input facts
// are available, once each, and project the results into field-keyed fact
// values. The MVP has only reference-table lookup, so there are no resolver
// cycles. A resolver whose inputs are not yet available is simply skipped (it
// may run after manual answers); a resolver that runs but finds no row marks
// its output facts unavailable.
export async function resolveFactsFromSnapshot(
  input: ResolveFactsInput,
): Promise<ResolveFactsResult> {
  const fieldIdByFactId = new Map(
    input.bindings.map((b) => [b.factId, b.fieldId]),
  );
  const tableBySource = new Map(input.tables.map((t) => [t.dataSourceId, t]));
  const values: ResolvedFactValue[] = [];
  const unavailable: { factId: string; reason: string }[] = [];
  const resolvedFactIds = new Set<string>();

  const withField = (v: ResolvedFactValue): ResolvedFactValue => {
    const fieldId = fieldIdByFactId.get(v.factId);
    return fieldId ? { ...v, fieldId } : v;
  };

  for (const resolver of input.resolvers) {
    if (resolver.status !== 'active') continue;
    const inputsReady = resolver.inputFactIds.every((id) =>
      input.availableFacts.has(id),
    );
    if (!inputsReady) continue;

    const table = tableBySource.get(resolver.dataSourceId);
    if (!table) {
      for (const m of resolver.outputMappings) {
        if (resolvedFactIds.has(m.factId)) continue;
        unavailable.push({ factId: m.factId, reason: 'no_reference_table' });
      }
      continue;
    }

    const result = await resolveReferenceTableRecipe({
      recipeId: resolver.id,
      dataSourceId: resolver.dataSourceId,
      referenceTableId: table.referenceTableId,
      referenceTableVersion: table.version,
      keyColumns: table.keyColumns,
      parameterKeyMappings: resolver.parameterKeyMappings,
      outputMappings: resolver.outputMappings,
      availableFacts: input.availableFacts,
      factsById: input.factsById,
      fetchRowByHash: input.fetchRowByHash,
      now: input.now,
    });

    if (result.matched) {
      for (const v of result.values) {
        if (resolvedFactIds.has(v.factId)) continue;
        if (v.state === 'resolved') resolvedFactIds.add(v.factId);
        values.push(withField(v));
      }
    } else if (result.missingKeys.length === 0) {
      // Ran but no row matched: mark outputs unavailable.
      for (const m of resolver.outputMappings) {
        if (resolvedFactIds.has(m.factId)) continue;
        unavailable.push({ factId: m.factId, reason: 'no_match' });
      }
    }
  }

  return { values, unavailable };
}
