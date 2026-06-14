import { FileText } from 'lucide-react';

export type FactSheetRow = {
  factId: string;
  name: string;
  value?: string;
  state: string;
  sourceKind?: string;
  sensitive?: boolean;
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
// and state badge.
export function FactSheet({ rows }: { rows: FactSheetRow[] }) {
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
            <tr
              key={row.factId}
              className="border-b border-line-subtle last:border-0"
            >
              <td className="px-4 py-2.5 text-fg-muted">{row.name}</td>
              <td className="px-4 py-2.5 font-medium text-fg">
                {row.value ?? '—'}
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
                    STATE_STYLES[row.state] ??
                    'bg-surface-subtle text-fg-subtle'
                  }`}
                >
                  {row.state.replace(/_/g, ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
