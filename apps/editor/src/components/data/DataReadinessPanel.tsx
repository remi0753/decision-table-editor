import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { DataReadinessResult } from '@/lib/cloudApi';

// Publish readiness summary for a logic's data layer (§7.6). The publish route
// enforces the same checks server-side; this panel is the usability checklist.
export function DataReadinessPanel({
  readiness,
  loading,
}: {
  readiness: DataReadinessResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded border border-line bg-surface px-4 py-3 text-sm text-fg-subtle">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking readiness…
      </div>
    );
  }
  if (!readiness) return null;

  if (!readiness.dataConnected) {
    return (
      <div className="rounded border border-line bg-surface px-4 py-3 text-sm text-fg-subtle">
        This logic has no fact bindings yet, so it publishes as a normal
        (non-data-connected) logic. Bind a field to a fact to make it
        data-connected.
      </div>
    );
  }

  const blocks = readiness.issues.filter((i) => i.severity === 'block');
  const warnings = readiness.issues.filter((i) => i.severity === 'warn');

  return (
    <div className="rounded border border-line bg-surface">
      <div
        className={`flex items-center gap-2 border-b border-line-subtle px-4 py-3 text-sm font-medium ${
          readiness.ok ? 'text-success-fg' : 'text-danger-fg'
        }`}
      >
        {readiness.ok ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        {readiness.ok
          ? 'Ready to publish'
          : `${blocks.length} issue${blocks.length === 1 ? '' : 's'} block publishing`}
      </div>
      {readiness.issues.length === 0 ? (
        <p className="px-4 py-3 text-sm text-fg-subtle">
          All data readiness checks pass.
        </p>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {[...blocks, ...warnings].map((issue) => (
            <li
              key={`${issue.code}:${issue.fieldId ?? ''}:${issue.factId ?? ''}`}
              className="flex items-start gap-2 px-4 py-2.5 text-sm"
            >
              {issue.severity === 'block' ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-fg" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" />
              )}
              <span className="text-fg-secondary">{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
