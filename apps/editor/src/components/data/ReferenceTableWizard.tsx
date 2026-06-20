import { CheckCircle2, Loader2, Search, Upload, X } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  appendReferenceTable,
  type CloudFact,
  type CloudReferenceTable,
  createReferenceTable,
  type ReferenceColumnMappingInput,
  replaceReferenceTable,
} from '@/lib/cloudApi';

type WizardMode =
  | { kind: 'create' }
  | { kind: 'replace' | 'append'; table: CloudReferenceTable };

type Preview = {
  headers: string[];
  rows: string[][];
  headerCandidates: string[][];
};

type LookupValue = {
  factId: string;
  value?: string;
  state: 'resolved' | 'unavailable' | 'invalid';
  message?: string;
};

type LookupResult = {
  matched: boolean;
  values: LookupValue[];
};

// Lightweight CSV preview parser. The server runs the authoritative RFC 4180
// parse on upload; this powers header selection, conversion preview, and a
// sample lookup before the operator saves the table.
function parseRecords(text: string, maxRows = 12): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < input.length && records.length < maxRows) {
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
  if ((field !== '' || row.length > 0) && records.length < maxRows) {
    row.push(field.trim());
    records.push(row);
  }
  return records;
}

function buildPreview(text: string, headerRowIndex: number): Preview | null {
  const records = parseRecords(text, Math.max(12, headerRowIndex + 7));
  const headers = records[headerRowIndex] ?? [];
  if (headers.length === 0) return null;
  return {
    headers,
    rows: records.slice(headerRowIndex + 1, headerRowIndex + 6),
    headerCandidates: records.slice(0, 5),
  };
}

function normalizeKey(value: unknown) {
  return String(value ?? '').trim();
}

function duplicateHeaderNames(headers: string[]): string[] {
  const counts = new Map<string, number>();
  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const reported = new Set<string>();
  const duplicates: string[] = [];
  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    if ((counts.get(normalized) ?? 0) <= 1 || reported.has(normalized)) {
      continue;
    }
    duplicates.push(header);
    reported.add(normalized);
  }
  return duplicates;
}

function localNormalize(
  raw: unknown,
  fact: CloudFact | undefined,
): { state: LookupValue['state']; value?: string; message?: string } {
  const value = String(raw ?? '').trim();
  if (!value) return { state: 'unavailable', message: 'Empty source value.' };
  if (!fact) return { state: 'invalid', message: 'Mapped fact is not active.' };
  if (fact.type === 'number') {
    const cleaned = value.replace(/[\s,]/g, '');
    return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)
      ? { state: 'resolved', value: String(Number(cleaned)) }
      : { state: 'invalid', message: `"${value}" is not a valid number.` };
  }
  if (fact.type === 'bool') {
    const lower = value.toLowerCase();
    if (['true', 't', 'yes', 'y', '1', 'on'].includes(lower)) {
      return { state: 'resolved', value: 'true' };
    }
    if (['false', 'f', 'no', 'n', '0', 'off'].includes(lower)) {
      return { state: 'resolved', value: 'false' };
    }
    return { state: 'invalid', message: `"${value}" is not a valid boolean.` };
  }
  if (fact.type === 'enum') {
    const allowed = fact.enumValues ?? [];
    const exact = allowed.find((v) => v === value);
    if (exact) return { state: 'resolved', value: exact };
    const ci = allowed.find((v) => v.toLowerCase() === value.toLowerCase());
    if (ci) return { state: 'resolved', value: ci };
    return { state: 'invalid', message: `"${value}" is not in the enum.` };
  }
  if (fact.type === 'date' || fact.type === 'datetime') {
    const parsed = new Date(value.replace(/\//g, '-'));
    if (Number.isNaN(parsed.getTime())) {
      return { state: 'invalid', message: `"${value}" is not a valid date.` };
    }
    if (fact.type === 'datetime') {
      return { state: 'resolved', value: parsed.toISOString() };
    }
    return { state: 'resolved', value: parsed.toISOString().slice(0, 10) };
  }
  return { state: 'resolved', value };
}

export function ReferenceTableWizard({
  workspaceId,
  facts,
  mode = { kind: 'create' },
  onClose,
  onCreated,
}: {
  workspaceId: string;
  facts: CloudFact[];
  mode?: WizardMode;
  onClose: () => void;
  onCreated: () => void;
}) {
  const lockedVersion = mode.kind === 'create' ? null : mode.table.activeVersion;
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState('');
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [name, setName] = useState(mode.kind === 'create' ? '' : mode.table.name);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [keyColumns, setKeyColumns] = useState<string[]>(
    lockedVersion?.keyColumns ?? [],
  );
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (lockedVersion?.columns ?? [])
        .filter((col) => col.factId)
        .map((col) => [col.name, col.factId as string]),
    ),
  );
  const [lookupKeys, setLookupKeys] = useState<Record<string, string>>({});
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [saving, setSaving] = useState(false);

  const activeFacts = useMemo(
    () => facts.filter((f) => f.status === 'active'),
    [facts],
  );
  const factsById = useMemo(
    () => new Map(activeFacts.map((fact) => [fact.id, fact])),
    [activeFacts],
  );
  const lockedSchema = mode.kind !== 'create' && Boolean(lockedVersion);
  const actionLabel =
    mode.kind === 'append'
      ? 'Append rows'
      : mode.kind === 'replace'
        ? 'Replace table'
        : 'Upload table';

  const resetLookup = () => {
    setLookupKeys({});
    setLookupResult(null);
  };

  const refreshPreview = (text: string, rowIndex: number) => {
    const parsed = buildPreview(text, rowIndex);
    setPreview(parsed);
    if (!parsed) {
      toast.error('Could not read any columns from this file.');
      return;
    }
    if (lockedSchema) {
      setKeyColumns(lockedVersion?.keyColumns ?? []);
      setMapping(
        Object.fromEntries(
          (lockedVersion?.columns ?? [])
            .filter((col) => col.factId)
            .map((col) => [col.name, col.factId as string]),
        ),
      );
    } else {
      setKeyColumns([]);
      setMapping({});
    }
    resetLookup();
  };

  const handleFile = async (next: File | null) => {
    setFile(next);
    setFileText('');
    setPreview(null);
    resetLookup();
    if (!lockedSchema) {
      setKeyColumns([]);
      setMapping({});
    }
    if (!next) return;
    if (mode.kind === 'create' && !name) setName(next.name.replace(/\.[^.]+$/, ''));
    try {
      const text = await next.text();
      setFileText(text);
      setHeaderRowIndex(0);
      refreshPreview(text, 0);
    } catch {
      toast.error('Could not read this file.');
    }
  };

  const handleHeaderChange = (rowIndex: number) => {
    setHeaderRowIndex(rowIndex);
    refreshPreview(fileText, rowIndex);
  };

  const toggleKey = (col: string, checked: boolean) => {
    setKeyColumns((current) =>
      checked ? [...current, col] : current.filter((c) => c !== col),
    );
    resetLookup();
  };

  const columnMappings: ReferenceColumnMappingInput[] = useMemo(
    () =>
      Object.entries(mapping)
        .filter(([, factId]) => factId)
        .map(([columnName, factId]) => ({ columnName, factId })),
    [mapping],
  );

  const conversionIssues = useMemo(() => {
    if (!preview) return [];
    const issues: string[] = [];
    for (const [rowIndex, row] of preview.rows.entries()) {
      for (const { columnName, factId } of columnMappings) {
        const fact = factsById.get(factId);
        const colIndex = preview.headers.indexOf(columnName);
        if (colIndex < 0) continue;
        const result = localNormalize(row[colIndex], fact);
        if (result.state === 'invalid') {
          issues.push(`Row ${rowIndex + 1}, ${columnName}: ${result.message}`);
        }
      }
    }
    return issues.slice(0, 5);
  }, [columnMappings, factsById, preview]);
  const schemaIssues = useMemo(() => {
    if (!preview || !lockedSchema || !lockedVersion) return [];
    const required = new Set([
      ...lockedVersion.keyColumns,
      ...lockedVersion.columns
        .filter((col) => col.factId)
        .map((col) => col.name),
    ]);
    return [...required]
      .filter((column) => !preview.headers.includes(column))
      .map((column) => `Missing required column "${column}".`);
  }, [lockedSchema, lockedVersion, preview]);
  const headerIssues = useMemo(() => {
    if (!preview) return [];
    return duplicateHeaderNames(preview.headers).map(
      (column) =>
        `Duplicate header "${column}". Choose a different header row or rename the CSV column.`,
    );
  }, [preview]);

  const runSampleLookup = () => {
    if (!preview) return;
    const missing = keyColumns.filter((col) => !normalizeKey(lookupKeys[col]));
    if (missing.length > 0) {
      toast.error(`Enter sample key value(s): ${missing.join(', ')}`);
      return;
    }
    const match = preview.rows.find((row) =>
      keyColumns.every((col) => {
        const idx = preview.headers.indexOf(col);
        return normalizeKey(row[idx]) === normalizeKey(lookupKeys[col]);
      }),
    );
    if (!match) {
      setLookupResult({ matched: false, values: [] });
      return;
    }
    const values = columnMappings.map(({ columnName, factId }) => {
      const fact = factsById.get(factId);
      const idx = preview.headers.indexOf(columnName);
      const result = localNormalize(match[idx], fact);
      return { factId, ...result };
    });
    setLookupResult({ matched: true, values });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('Choose a CSV file.');
      return;
    }
    if (mode.kind === 'create' && !name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (keyColumns.length === 0) {
      toast.error('Select at least one key column.');
      return;
    }
    if (
      headerIssues.length > 0 ||
      schemaIssues.length > 0 ||
      conversionIssues.length > 0
    ) {
      toast.error('Fix table issues before saving.');
      return;
    }
    if (preview?.rows.length && !lookupResult) {
      toast.error('Run a sample lookup before saving.');
      return;
    }

    setSaving(true);
    try {
      const metadata = {
        name: name.trim(),
        headerRowIndex,
        keyColumns,
        columnMappings,
      };
      if (mode.kind === 'append') {
        await appendReferenceTable(mode.table.id, file, metadata);
      } else if (mode.kind === 'replace') {
        await replaceReferenceTable(mode.table.id, file, metadata);
      } else {
        await createReferenceTable(workspaceId, file, metadata);
      }
      toast.success(
        mode.kind === 'append'
          ? 'Rows appended.'
          : mode.kind === 'replace'
            ? 'Reference table replaced.'
            : 'Reference table uploaded.',
      );
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const factName = (factId: string) =>
    facts.find((fact) => fact.id === factId)?.name ?? factId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ref-wizard-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <div>
            <h2 id="ref-wizard-title" className="text-lg font-semibold text-fg">
              {actionLabel}
            </h2>
            {mode.kind !== 'create' ? (
              <p className="mt-1 text-xs text-fg-muted">
                {mode.table.name} uses the existing key columns and fact
                mappings.
              </p>
            ) : null}
          </div>
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
              disabled={mode.kind !== 'create'}
              placeholder="Orders"
              className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring disabled:bg-surface-muted disabled:text-fg-muted"
            />
          </label>

          {preview ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-fg-muted">
                  Header row
                </span>
                <select
                  value={headerRowIndex}
                  onChange={(event) =>
                    handleHeaderChange(Number(event.target.value))
                  }
                  className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                >
                  {preview.headerCandidates.map((row, index) => (
                    <option key={index} value={index}>
                      Row {index + 1}: {row.slice(0, 4).join(', ')}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-2 block text-xs font-medium text-fg-muted">
                  Columns
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
                      {preview.headers.map((header, index) => (
                        <tr
                          key={`${index}:${header}`}
                          className="border-b border-line-subtle last:border-0"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-fg">
                            {header}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={keyColumns.includes(header)}
                              disabled={lockedSchema}
                              onChange={(event) =>
                                toggleKey(header, event.target.checked)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={mapping[header] ?? ''}
                              disabled={lockedSchema}
                              onChange={(event) => {
                                setMapping((current) => ({
                                  ...current,
                                  [header]: event.target.value,
                                }));
                                resetLookup();
                              }}
                              className="h-9 w-full rounded border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring disabled:bg-surface-muted disabled:text-fg-muted"
                            >
                              <option value="">-- not mapped --</option>
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
                    Preview ({preview.rows.length} rows)
                  </span>
                  <div className="overflow-x-auto rounded border border-line">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-line-subtle bg-surface-muted text-left text-fg-subtle">
                          {preview.headers.map((h, col) => (
                            <th
                              key={`${col}:${h}`}
                              className="px-3 py-1.5 font-medium"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, index) => (
                          <tr
                            key={`${index}:${row.join('\u0001')}`}
                            className="border-b border-line-subtle last:border-0"
                          >
                            {preview.headers.map((h, col) => (
                              <td
                                key={`${col}:${h}`}
                                className="px-3 py-1.5 text-fg-muted"
                              >
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

              {headerIssues.length > 0 ||
              schemaIssues.length > 0 ||
              conversionIssues.length > 0 ? (
                <div className="rounded border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-fg">
                  <div className="font-medium">Table issues</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {headerIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                    {schemaIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                    {conversionIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : columnMappings.length > 0 ? (
                <p className="inline-flex items-center gap-2 rounded border border-success-border bg-success-bg px-3 py-2 text-xs text-success-fg">
                  <CheckCircle2 className="h-4 w-4" />
                  Preview rows convert cleanly.
                </p>
              ) : null}

              <div className="rounded border border-line p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-fg-muted">
                    Sample lookup before save
                  </span>
                  <button
                    type="button"
                    onClick={runSampleLookup}
                    className="inline-flex h-8 items-center gap-2 rounded border border-line px-3 text-xs font-medium text-fg-secondary hover:bg-surface-muted"
                  >
                    <Search className="h-4 w-4" />
                    Run lookup
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {keyColumns.map((col) => (
                    <label key={col} className="block">
                      <span className="mb-1 block text-xs text-fg-muted">
                        {col}
                      </span>
                      <input
                        value={lookupKeys[col] ?? ''}
                        onChange={(event) => {
                          setLookupKeys((current) => ({
                            ...current,
                            [col]: event.target.value,
                          }));
                          setLookupResult(null);
                        }}
                        className="h-9 w-full rounded border border-line px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                      />
                    </label>
                  ))}
                </div>
                {lookupResult ? (
                  lookupResult.matched ? (
                    <div className="mt-3 rounded border border-line">
                      <div className="border-b border-line-subtle bg-success-bg px-3 py-2 text-xs font-medium text-success-fg">
                        Matched -- {lookupResult.values.length} mapped value(s)
                      </div>
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          {lookupResult.values.map((value) => (
                            <tr
                              key={value.factId}
                              className="border-b border-line-subtle last:border-0"
                            >
                              <td className="px-3 py-2 text-fg-muted">
                                {factName(value.factId)}
                              </td>
                              <td className="px-3 py-2 font-medium text-fg">
                                {value.value ?? value.message ?? '--'}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-fg-subtle">
                                {value.state}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-3 rounded border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg">
                      No preview row matched that key.
                    </p>
                  )
                ) : null}
              </div>

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
              {actionLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
