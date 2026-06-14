import { Loader2, Save, X } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type CloudFact,
  type CloudReferenceTable,
  createResolver,
  type ResolverInput,
} from '@/lib/cloudApi';

const FALLBACK_POLICIES = ['ask_operator', 'mark_unavailable', 'block'];

export function ResolverEditorDialog({
  workspaceId,
  tables,
  facts,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  tables: CloudReferenceTable[];
  facts: CloudFact[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // Only tables with an active version can back a resolver.
  const usableTables = useMemo(
    () => tables.filter((t) => t.status === 'active' && t.activeVersion),
    [tables],
  );
  const activeFacts = useMemo(
    () => facts.filter((f) => f.status === 'active'),
    [facts],
  );

  const [name, setName] = useState('');
  const [dataSourceId, setDataSourceId] = useState(usableTables[0]?.id ?? '');
  const [fallbackPolicy, setFallbackPolicy] = useState('ask_operator');
  const [saving, setSaving] = useState(false);

  const selectedTable = usableTables.find((t) => t.id === dataSourceId) ?? null;
  const version = selectedTable?.activeVersion ?? null;
  const keyColumns = version?.keyColumns ?? [];
  const outputColumnDefs = (version?.columns ?? []).filter(
    (col) => !keyColumns.includes(col.name),
  );

  // Per-column fact selection, prefilled from the reference table's mappings.
  const [keyFactByColumn, setKeyFactByColumn] = useState<
    Record<string, string>
  >({});
  const [outputFactByColumn, setOutputFactByColumn] = useState<
    Record<string, string>
  >({});

  // Recompute prefill whenever the selected table changes.
  const tableKey = `${dataSourceId}:${version?.version ?? ''}`;
  const [prefilledFor, setPrefilledFor] = useState('');
  if (tableKey !== prefilledFor && version) {
    const keyDefaults: Record<string, string> = {};
    for (const col of keyColumns) {
      const def = version.columns.find((c) => c.name === col);
      if (def?.factId) keyDefaults[col] = def.factId;
    }
    const outputDefaults: Record<string, string> = {};
    for (const col of outputColumnDefs) {
      if (col.factId) outputDefaults[col.name] = col.factId;
    }
    setKeyFactByColumn(keyDefaults);
    setOutputFactByColumn(outputDefaults);
    setPrefilledFor(tableKey);
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    if (!selectedTable || !version) return toast.error('Choose a table.');

    for (const col of keyColumns) {
      if (!keyFactByColumn[col]) {
        return toast.error(`Map key column "${col}" to a fact.`);
      }
    }
    const keyColumnMappings = keyColumns.map((columnName) => ({
      columnName,
      factId: keyFactByColumn[columnName] as string,
    }));
    const outputMappings = Object.entries(outputFactByColumn)
      .filter(([, factId]) => factId)
      .map(([columnName, factId]) => ({ columnName, factId }));
    if (outputMappings.length === 0) {
      return toast.error('Map at least one output column to a fact.');
    }
    const inputFactIds = Array.from(
      new Set(keyColumnMappings.map((m) => m.factId)),
    );

    const input: ResolverInput = {
      name: name.trim(),
      dataSourceId,
      inputFactIds,
      parameterMappings: { keyColumns: keyColumnMappings },
      outputMappings,
      fallbackPolicy,
    };

    setSaving(true);
    try {
      await createResolver(workspaceId, input);
      toast.success('Resolver created.');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Create failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolver-editor-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <h2
            id="resolver-editor-title"
            className="text-lg font-semibold text-fg"
          >
            New resolver
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {usableTables.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-fg-subtle">
            Upload a reference table with an active version first — resolvers
            read from a reference table.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="Resolve order facts"
                className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Reference table
              </span>
              <select
                value={dataSourceId}
                onChange={(event) => setDataSourceId(event.target.value)}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                {usableTables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name} (v{table.activeVersion?.version})
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-2 block text-xs font-medium text-fg-muted">
                Key columns → input facts (the operator provides these)
              </span>
              <div className="space-y-2">
                {keyColumns.map((col) => (
                  <div key={col} className="flex items-center gap-3">
                    <code className="w-40 shrink-0 truncate rounded bg-surface-muted px-2 py-1 text-xs text-fg">
                      {col}
                    </code>
                    <select
                      value={keyFactByColumn[col] ?? ''}
                      onChange={(event) =>
                        setKeyFactByColumn((current) => ({
                          ...current,
                          [col]: event.target.value,
                        }))
                      }
                      className="h-9 w-full rounded border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    >
                      <option value="">— choose key fact —</option>
                      {activeFacts.map((fact) => (
                        <option key={fact.id} value={fact.id}>
                          {fact.name} ({fact.kind})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-medium text-fg-muted">
                Output columns → facts (resolved from a matched row)
              </span>
              <div className="space-y-2">
                {outputColumnDefs.map((col) => (
                  <div key={col.name} className="flex items-center gap-3">
                    <code className="w-40 shrink-0 truncate rounded bg-surface-muted px-2 py-1 text-xs text-fg">
                      {col.name}
                    </code>
                    <select
                      value={outputFactByColumn[col.name] ?? ''}
                      onChange={(event) =>
                        setOutputFactByColumn((current) => ({
                          ...current,
                          [col.name]: event.target.value,
                        }))
                      }
                      className="h-9 w-full rounded border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    >
                      <option value="">— not mapped —</option>
                      {activeFacts.map((fact) => (
                        <option key={fact.id} value={fact.id}>
                          {fact.name} ({fact.type})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                If a fact can't be resolved
              </span>
              <select
                value={fallbackPolicy}
                onChange={(event) => setFallbackPolicy(event.target.value)}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                {FALLBACK_POLICIES.map((policy) => (
                  <option key={policy} value={policy}>
                    {policy}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded border border-line px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Create resolver
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
