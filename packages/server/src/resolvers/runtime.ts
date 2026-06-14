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
