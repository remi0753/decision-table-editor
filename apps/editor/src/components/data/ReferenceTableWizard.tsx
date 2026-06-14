import { Loader2, Upload, X } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type CloudFact,
  createReferenceTable,
  type ReferenceColumnMappingInput,
} from '@/lib/cloudApi';

// Lightweight CSV preview parser. The server runs the authoritative RFC 4180
// parse on upload; this only powers header detection and a small row preview,
// so it handles quoted fields and escaped quotes but nothing exotic.
function parsePreview(
  text: string,
  maxRows = 5,
): { headers: string[]; rows: string[][] } {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < input.length && records.length <= maxRows) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field.trim());
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field.trim());
      records.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if ((field !== '' || row.length > 0) && records.length <= maxRows) {
    row.push(field.trim());
    records.push(row);
  }
  const headers = records[0] ?? [];
  return { headers, rows: records.slice(1) };
}

export function ReferenceTableWizard({
  workspaceId,
  facts,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  facts: CloudFact[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const activeFacts = useMemo(
    () => facts.filter((f) => f.status === 'active'),
    [facts],
  );

  const handleFile = async (next: File | null) => {
    setFile(next);
    setPreview(null);
    setKeyColumns([]);
    setMapping({});
    if (!next) return;
    if (!name) setName(next.name.replace(/\.[^.]+$/, ''));
    try {
      const text = await next.text();
      const parsed = parsePreview(text);
      if (parsed.headers.length === 0) {
        toast.error('Could not read any columns from this file.');
        return;
      }
      setPreview(parsed);
    } catch {
      toast.error('Could not read this file.');
    }
  };

  const toggleKey = (col: string, checked: boolean) => {
    setKeyColumns((current) =>
      checked ? [...current, col] : current.filter((c) => c !== col),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('Choose a CSV file.');
      return;
    }
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (keyColumns.length === 0) {
      toast.error('Select at least one key column.');
      return;
    }
    const columnMappings: ReferenceColumnMappingInput[] = Object.entries(
      mapping,
    )
      .filter(([, factId]) => factId)
      .map(([columnName, factId]) => ({ columnName, factId }));

    setSaving(true);
    try {
      await createReferenceTable(workspaceId, file, {
        name: name.trim(),
        headerRowIndex: 0,
        keyColumns,
        columnMappings,
      });
      toast.success('Reference table uploaded.');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ref-wizard-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <h2 id="ref-wizard-title" className="text-lg font-semibold text-fg">
            Upload reference table
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

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              CSV file (max 5 MB)
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                void handleFile(event.target.files?.[0] ?? null)
              }
              className="block w-full text-sm text-fg-secondary file:mr-3 file:rounded file:border file:border-line file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Table name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Orders"
              className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </label>

          {preview ? (
            <>
              <div>
                <span className="mb-2 block text-xs font-medium text-fg-muted">
                  Columns — pick key column(s) and map outputs to facts
                </span>
                <div className="overflow-hidden rounded border border-line">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line-subtle bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                        <th className="px-3 py-2">Column</th>
                        <th className="w-16 px-3 py-2 text-center">Key</th>
                        <th className="px-3 py-2">Maps to fact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.headers.map((header) => (
                        <tr
                          key={header}
                          className="border-b border-line-subtle last:border-0"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-fg">
                            {header}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={keyColumns.includes(header)}
                              onChange={(event) =>
                                toggleKey(header, event.target.checked)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={mapping[header] ?? ''}
                              onChange={(event) =>
                                setMapping((current) => ({
                                  ...current,
                                  [header]: event.target.value,
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {preview.rows.length > 0 ? (
                <div>
                  <span className="mb-2 block text-xs font-medium text-fg-muted">
                    Preview ({preview.rows.length} of first rows)
                  </span>
                  <div className="overflow-x-auto rounded border border-line">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-line-subtle bg-surface-muted text-left text-fg-subtle">
                          {preview.headers.map((h) => (
                            <th key={h} className="px-3 py-1.5 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr
                            key={row.join('')}
                            className="border-b border-line-subtle last:border-0"
                          >
                            {preview.headers.map((h, col) => (
                              <td key={h} className="px-3 py-1.5 text-fg-muted">
                                {row[col] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeFacts.length === 0 ? (
                <p className="rounded border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-fg">
                  No active facts to map yet. Create facts first, then map
                  output columns so resolvers can use this table.
                </p>
              ) : null}
            </>
          ) : null}

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
              disabled={saving || !preview}
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload table
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
