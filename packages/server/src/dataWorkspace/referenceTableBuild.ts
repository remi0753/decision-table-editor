// Pure builder that turns a parsed CSV + upload metadata into the column
// descriptors, key columns, and per-row records (with key hashes) that the
// reference-table routes persist. DB-free and async only because key hashing
// uses Web Crypto. Enforces the MVP limits (§3.5) and the reject-duplicate-keys
// upload policy (§6.4).

import { buildRowKeyHash } from '../resolvers/referenceTable.js';
import type { Normalizer } from '../resolvers/types.js';
import type { ParsedCsv } from './csv.js';

export const MAX_REFERENCE_ROWS = 20_000;
export const MAX_REFERENCE_COLUMNS = 50;
export const MAX_REFERENCE_FILE_BYTES = 5 * 1024 * 1024;

export interface ColumnMappingInput {
  columnName: string;
  factId: string;
  normalizer?: Normalizer;
}

export interface ColumnDef {
  name: string;
  factId?: string;
  normalizer?: Normalizer;
}

export interface ReferenceUploadMetadata {
  keyColumns: string[];
  columnMappings: ColumnMappingInput[];
}

export interface ReferenceRowRecord {
  rowIndex: number;
  keyHash: string;
  keyValues: Record<string, string>;
  data: Record<string, string>;
}

export interface BuiltReferenceTable {
  columns: ColumnDef[];
  keyColumns: string[];
  rows: ReferenceRowRecord[];
  rowCount: number;
}

export interface ReferenceBuildError {
  code: string;
  message: string;
}

// Validate metadata against the parsed CSV and an allowlist of active fact ids,
// then build the persistable column/key/row structures.
export async function buildReferenceTable(
  parsed: ParsedCsv,
  metadata: ReferenceUploadMetadata,
  activeFactIds: Set<string>,
): Promise<
  | { ok: true; value: BuiltReferenceTable }
  | { ok: false; error: ReferenceBuildError }
> {
  const { headers, rows } = parsed;

  if (headers.length > MAX_REFERENCE_COLUMNS) {
    return {
      ok: false,
      error: {
        code: 'too_many_columns',
        message: `A reference table can have at most ${MAX_REFERENCE_COLUMNS} columns.`,
      },
    };
  }
  if (rows.length > MAX_REFERENCE_ROWS) {
    return {
      ok: false,
      error: {
        code: 'too_many_rows',
        message: `A reference table can have at most ${MAX_REFERENCE_ROWS} rows.`,
      },
    };
  }

  const headerSet = new Set(headers);

  if (!Array.isArray(metadata.keyColumns) || metadata.keyColumns.length === 0) {
    return {
      ok: false,
      error: {
        code: 'key_columns_required',
        message: 'At least one key column is required.',
      },
    };
  }
  const seenKey = new Set<string>();
  for (const col of metadata.keyColumns) {
    if (!headerSet.has(col)) {
      return {
        ok: false,
        error: {
          code: 'unknown_key_column',
          message: `Key column "${col}" is not a CSV header.`,
        },
      };
    }
    if (seenKey.has(col)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_key_column',
          message: `Key column "${col}" is listed twice.`,
        },
      };
    }
    seenKey.add(col);
  }

  const mappings = metadata.columnMappings ?? [];
  const mappingByColumn = new Map<string, ColumnMappingInput>();
  const seenFact = new Set<string>();
  for (const m of mappings) {
    if (!headerSet.has(m.columnName)) {
      return {
        ok: false,
        error: {
          code: 'unknown_mapped_column',
          message: `Mapped column "${m.columnName}" is not a CSV header.`,
        },
      };
    }
    if (!activeFactIds.has(m.factId)) {
      return {
        ok: false,
        error: {
          code: 'unknown_fact',
          message: `Column "${m.columnName}" maps to a fact that is not active in this workspace.`,
        },
      };
    }
    if (mappingByColumn.has(m.columnName)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_column_mapping',
          message: `Column "${m.columnName}" is mapped more than once.`,
        },
      };
    }
    if (seenFact.has(m.factId)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_fact_mapping',
          message: 'Each fact can be mapped from at most one column.',
        },
      };
    }
    mappingByColumn.set(m.columnName, m);
    seenFact.add(m.factId);
  }

  const columns: ColumnDef[] = headers.map((name) => {
    const m = mappingByColumn.get(name);
    return m ? { name, factId: m.factId, normalizer: m.normalizer } : { name };
  });

  const built: ReferenceRowRecord[] = [];
  const seenHash = new Set<string>();
  for (const [i, data] of rows.entries()) {
    const keyValues: Record<string, string> = {};
    for (const col of metadata.keyColumns) keyValues[col] = data[col] ?? '';
    const keyHash = await buildRowKeyHash(metadata.keyColumns, data);
    if (seenHash.has(keyHash)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_key',
          message: `Duplicate key in row ${i + 1}: ${metadata.keyColumns
            .map((c) => `${c}=${keyValues[c]}`)
            .join(', ')}.`,
        },
      };
    }
    seenHash.add(keyHash);
    built.push({ rowIndex: i, keyHash, keyValues, data });
  }

  return {
    ok: true,
    value: {
      columns,
      keyColumns: metadata.keyColumns,
      rows: built,
      rowCount: built.length,
    },
  };
}
