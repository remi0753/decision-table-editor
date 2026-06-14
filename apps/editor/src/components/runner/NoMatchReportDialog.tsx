import { Loader2, Send, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { createDecisionReport, type DecisionReportKind } from '@/lib/cloudApi';

const REPORT_KINDS: { value: DecisionReportKind; label: string }[] = [
  { value: 'no_match', label: 'No matching rule' },
  { value: 'wrong_fact', label: 'Wrong or outdated fact' },
  { value: 'missing_source', label: 'Missing data source' },
  { value: 'confusing_question', label: 'Confusing question' },
  { value: 'wrong_result_text', label: 'Incorrect result text' },
  { value: 'exception_required', label: 'Exception required' },
];

// Operator feedback report (§5.9, §13.3). Attaches to the decision session so
// logic owners can triage it in their queue.
export function NoMatchReportDialog({
  sessionId,
  defaultKind = 'no_match',
  onClose,
}: {
  sessionId: string;
  defaultKind?: DecisionReportKind;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<DecisionReportKind>(defaultKind);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    setSending(true);
    try {
      await createDecisionReport(sessionId, { kind, note: note.trim() });
      toast.success('Report sent to the logic owner.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not report.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">Report an issue</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg-subtle hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              What went wrong?
            </span>
            <select
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as DecisionReportKind)
              }
              className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
            >
              {REPORT_KINDS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Customer was within policy but no row matched."
              className="w-full rounded border border-line px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded border border-line px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={sending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send report
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
