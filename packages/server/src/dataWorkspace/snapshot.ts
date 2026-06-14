// Publish-time data snapshot builder (§3.7). Assembles the pinned data-layer
// references for a published version and computes a stable snapshot_hash that is
// the user-visible "data definition version". Pure and DB-free.

export interface SnapshotBinding {
  fieldId: string;
  factId: string;
}

export interface SnapshotReferenceTable {
  dataSourceId: string;
  referenceTableId: string;
  version: number;
}

export interface SnapshotInput {
  bindings: SnapshotBinding[];
  factDefinitions: unknown[];
  resolverRecipes: unknown[];
  dataSources: unknown[];
  referenceTables: SnapshotReferenceTable[];
}

export interface DataSnapshot extends SnapshotInput {
  snapshotHash: string;
}

// Deterministic JSON: object keys sorted recursively so the hash is stable
// regardless of property insertion order.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
  return `{${entries.join(',')}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Build the snapshot payload + hash. Arrays are sorted by a stable key before
// hashing so the bundle identity does not depend on DB row ordering.
export async function buildDataSnapshot(
  input: SnapshotInput,
): Promise<DataSnapshot> {
  const bindings = [...input.bindings].sort((a, b) =>
    a.fieldId.localeCompare(b.fieldId),
  );
  const referenceTables = [...input.referenceTables].sort((a, b) =>
    a.referenceTableId.localeCompare(b.referenceTableId),
  );
  const sortById = (rows: unknown[]) =>
    [...rows].sort((a, b) =>
      String((a as { id?: string }).id ?? '').localeCompare(
        String((b as { id?: string }).id ?? ''),
      ),
    );
  const factDefinitions = sortById(input.factDefinitions);
  const resolverRecipes = sortById(input.resolverRecipes);
  const dataSources = sortById(input.dataSources);

  const canonical = stableStringify({
    bindings,
    factDefinitions,
    resolverRecipes,
    dataSources,
    referenceTables,
  });
  const snapshotHash = await sha256Hex(canonical);

  return {
    bindings,
    factDefinitions,
    resolverRecipes,
    dataSources,
    referenceTables,
    snapshotHash,
  };
}
