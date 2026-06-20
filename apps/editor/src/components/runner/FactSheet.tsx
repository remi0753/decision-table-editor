import { Check, FileText, Pencil, X } from 'lucide-react';
import { useState } from 'react';

export type FactSheetRow = {
  factId: string;
  name: string;
  value?: string;
  rawValue?: string;
  state: string;
  sourceKind?: string;
  sensitive?: boolean;
  provenance?: Record<string, unknown>;
  editable?: boolean;
};

const STATE_STYLES: Record<string, string> = {
  resolved: 'bg-success-bg text-success-fg',
  confirmed: 'bg-success-bg text-success-fg',
  manual: 'bg-brand-subtle text-brand-fg',
  needs_confirmation: 'bg-warning-bg text-warning-fg',
  unavailable: 'bg-surface-subtle text-fg-subtle',
  invalid: 'bg-danger-bg text-danger-fg',
  missing: 'bg-surface-subtle text-fg-subtle',
  hidden: 'bg-surface-subtle text-fg-subtle',
};

const SOURCE_LABELS: Record<string, string> = {
  reference_table: 'reference table',
  manual: 'manual',
  url_query: 'url',
  clipboard: 'clipboard',
  api: 'api',
  derived: 'derived',
  internal: 'internal',
  embed: 'embed',
};

// Resolved-facts case sheet (§8.3): one row per fact with value, source badge,
// state badge, provenance details, and visible correction actions.
export function FactSheet({
  rows,
  onCorrect,
}: {
  rows: FactSheetRow[];
  onCorrect?: (factId: string, value: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
        <FileText className="h-4 w-4 text-fg-faint" />
        <h2 className="text-sm font-semibold text-fg">Facts</h2>
      </div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row) => (
            <FactSheetTableRow
              key={row.factId}
              row={row}
              onCorrect={onCorrect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactSheetTableRow({
  row,
  onCorrect,
}: {
  row: FactSheetRow;
  onCorrect?: (factId: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.rawValue ?? row.value ?? '');
  const canEdit = row.editable && onCorrect;
  const details = factDetails(row);

  const save = () => {
    const value = draft.trim();
    if (!value) return;
    onCorrect?.(row.factId, value);
    setEditing(false);
  };

  return (
    <tr className="border-b border-line-subtle last:border-0 align-top">
      <td className="px-4 py-2.5 text-fg-muted">{row.name}</td>
      <td className="px-4 py-2.5 font-medium text-fg">
        {editing ? (
          <div className="flex max-w-xs items-center gap-1">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') save();
                if (event.key === 'Escape') setEditing(false);
              }}
              className="h-8 min-w-0 flex-1 rounded border border-line px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              // biome-ignore lint/a11y/noAutofocus: intentional — focus the inline edit field the user just opened
              autoFocus
            />
            <button
              type="button"
              onClick={save}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-success-fg hover:bg-success-bg"
              aria-label={`Save ${row.name}`}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
              aria-label="Cancel edit"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{row.value ?? '—'}</span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(row.rawValue ?? row.value ?? '');
                  setEditing(true);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
                aria-label={`Correct ${row.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        )}
        {details.length > 0 ? (
          <details className="mt-1 text-xs font-normal text-fg-subtle">
            <summary className="cursor-pointer">Details</summary>
            <dl className="mt-1 grid gap-1">
              {details.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="w-24 shrink-0 text-fg-faint">{label}</dt>
                  <dd className="min-w-0 break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        {row.sourceKind ? (
          <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs text-fg-subtle">
            {SOURCE_LABELS[row.sourceKind] ?? row.sourceKind}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            STATE_STYLES[row.state] ?? 'bg-surface-subtle text-fg-subtle'
          }`}
        >
          {row.state.replace(/_/g, ' ')}
        </span>
      </td>
    </tr>
  );
}

function factDetails(row: FactSheetRow): [string, string][] {
  const p = row.provenance ?? {};
  const items: [string, string][] = [];
  const add = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    items.push([label, String(value)]);
  };
  add('Resolver', p.resolverRecipeId);
  add('Retrieved', p.retrievedAt);
  add('Source ver.', p.referenceTableVersion);
  add('Column', p.sourceColumn);
  add('Evidence', p.evidenceLabel);
  add('Confidence', p.confidence);
  return items;
}
