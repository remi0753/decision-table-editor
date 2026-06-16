// Reference table key hashing and row projection (§6.4). Pure and DB-free: the
// route does the DB row lookup by key_hash; these helpers compute the hash and
// turn a matched row into normalized fact values with provenance.

import { normalizeFactValue } from './normalize.js';
import type {
  DecisionFactSourceKind,
  FactProvenance,
  FactView,
  OutputMapping,
  ResolvedFactValue,
} from './types.js';

// Key normalization before hashing (§6.4). Trim only: order IDs and similar
// keys are case-sensitive, so we do not case-fold. Upload and lookup MUST use
// this same function or hashes will not match.
export function normalizeKeyValue(raw: unknown): string {
  return String(raw ?? '').trim();
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Hash normalized key values in configured key-column order. Single key column
// hashes the value directly; composite keys hash the stable JSON array so
// ["a","b"] and ["ab"] cannot collide. Used identically at upload and lookup.
export async function computeKeyHash(values: string[]): Promise<string> {
  const normalized = values.map(normalizeKeyValue);
  const canonical =
    normalized.length === 1
      ? (normalized[0] ?? '')
      : JSON.stringify(normalized);
  return sha256Hex(canonical);
}

// Build the key hash for one uploaded row given the table's key column names.
// Missing key cells are treated as empty strings (the row is still indexed; an
// all-empty key is allowed but will simply never match a real lookup).
export function buildRowKeyHash(
  keyColumns: string[],
  rowData: Record<string, unknown>,
): Promise<string> {
  return computeKeyHash(
    keyColumns.map((col) => normalizeKeyValue(rowData[col])),
  );
}

// Build the key hash for a lookup, reading values by column name in the table's
// key-column order. Reports which key columns had no value supplied.
export async function buildLookupKeyHash(
  keyColumns: string[],
  valuesByColumn: Record<string, string | undefined>,
): Promise<{ ok: true; hash: string } | { ok: false; missing: string[] }> {
  const missing = keyColumns.filter(
    (col) => normalizeKeyValue(valuesByColumn[col]) === '',
  );
  if (missing.length > 0) return { ok: false, missing };
  const hash = await computeKeyHash(
    keyColumns.map((col) => valuesByColumn[col] ?? ''),
  );
  return { ok: true, hash };
}

// Project a matched row's data into resolved fact values via the output
// mappings, normalizing each cell against its fact. A cell that fails
// normalization becomes invalid; an empty cell becomes unavailable. Provenance
// is filled with the source column and the supplied base (table/source/recipe
// ids + retrievedAt).
export function projectRow(
  rowData: Record<string, unknown>,
  outputMappings: OutputMapping[],
  factsById: Map<string, FactView>,
  provenanceBase: Partial<FactProvenance> & { retrievedAt: string },
  sourceKind: DecisionFactSourceKind = 'reference_table',
): ResolvedFactValue[] {
  const values: ResolvedFactValue[] = [];
  for (const mapping of outputMappings) {
    const fact = factsById.get(mapping.factId);
    const provenance: FactProvenance = {
      ...provenanceBase,
      sourceColumn: mapping.columnName,
    };
    if (!fact) {
      // Output maps to a fact not present in the catalog/snapshot: skip safely.
      continue;
    }
    // Read by source field name. For HTTP records a dotted field path is
    // supported so nested response objects can be mapped.
    const raw = readField(rowData, mapping.columnName);
    const result = normalizeFactValue(raw, fact, mapping.normalizer);
    if (result.ok) {
      values.push({
        factId: mapping.factId,
        value: result.value,
        state: 'resolved',
        sourceKind,
        provenance,
      });
    } else {
      values.push({
        factId: mapping.factId,
        state: result.state,
        sourceKind,
        provenance,
      });
    }
  }
  return values;
}

// Read a (possibly dotted) field path from a record. A non-dotted name reads the
// top-level key directly, so reference-table / DB column names with dots are
// still matched first.
export function readField(
  record: Record<string, unknown>,
  field: string,
): unknown {
  if (field in record) return record[field];
  if (!field.includes('.')) return undefined;
  let cursor: unknown = record;
  for (const part of field.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}
