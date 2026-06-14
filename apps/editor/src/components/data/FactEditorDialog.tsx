import { Loader2, Save, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import type {
  CloudFact,
  FactInput,
  FactKind,
  FactLoggingPolicy,
  FactType,
} from '@/lib/cloudApi';

// derived_fact is reserved in the MVP (no computation engine), so it is not
// offered as a creatable kind.
const FACT_KINDS: { value: FactKind; label: string }[] = [
  { value: 'key', label: 'Key (identifies a case)' },
  { value: 'system_fact', label: 'System fact (resolved from a source)' },
  { value: 'manual_fact', label: 'Manual fact (asked from operator)' },
  { value: 'internal_fact', label: 'Internal fact (hidden from operator)' },
];

const FACT_TYPES: FactType[] = [
  'string',
  'number',
  'bool',
  'enum',
  'date',
  'datetime',
];

const LOGGING_POLICIES: FactLoggingPolicy[] = [
  'full',
  'masked',
  'hash',
  'omit',
];

function linesToList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function FactEditorDialog({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: CloudFact;
  onClose: () => void;
  onSubmit: (input: FactInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<FactType>(initial?.type ?? 'string');
  const [kind, setKind] = useState<FactKind>(initial?.kind ?? 'manual_fact');
  const [enumValues, setEnumValues] = useState(
    (initial?.enumValues ?? []).join('\n'),
  );
  const [aliases, setAliases] = useState((initial?.aliases ?? []).join('\n'));
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [sensitive, setSensitive] = useState(initial?.sensitive ?? false);
  const [loggingPolicy, setLoggingPolicy] = useState<FactLoggingPolicy>(
    initial?.loggingPolicy ?? 'full',
  );
  const [saving, setSaving] = useState(false);

  const isEdit = mode === 'edit';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (type === 'enum' && linesToList(enumValues).length === 0) {
      toast.error('Enum facts need at least one value.');
      return;
    }
    if (kind === 'manual_fact' && !question.trim()) {
      toast.error('Manual facts need an operator question.');
      return;
    }

    const input: FactInput = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      kind,
      enumValues: type === 'enum' ? linesToList(enumValues) : null,
      aliases: linesToList(aliases),
      question: question.trim() || null,
      sensitive,
      loggingPolicy,
    };

    setSaving(true);
    try {
      await onSubmit(input);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="fact-editor-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <h2 id="fact-editor-title" className="text-lg font-semibold text-fg">
            {isEdit ? 'Edit fact' : 'New fact'}
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

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              placeholder="Purchase date"
              className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Business meaning and edge cases"
              className="w-full rounded border border-line px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Kind
              </span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as FactKind)}
                disabled={isEdit}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring disabled:bg-surface-muted disabled:text-fg-subtle"
              >
                {FACT_KINDS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Type
              </span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as FactType)}
                disabled={isEdit}
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring disabled:bg-surface-muted disabled:text-fg-subtle"
              >
                {FACT_TYPES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {type === 'enum' ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Enum values (one per line)
              </span>
              <textarea
                value={enumValues}
                onChange={(event) => setEnumValues(event.target.value)}
                rows={3}
                placeholder={'Gold\nSilver\nBronze'}
                className="w-full rounded border border-line px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
            </label>
          ) : null}

          {kind === 'manual_fact' ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Operator question
              </span>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Was the item opened?"
                className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Aliases (one per line — used for key extraction)
            </span>
            <textarea
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              rows={2}
              placeholder={'order_id\n注文番号'}
              className="w-full rounded border border-line px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
            />
          </label>

          <div className="grid items-end gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-fg-secondary">
              <input
                type="checkbox"
                checked={sensitive}
                onChange={(event) => setSensitive(event.target.checked)}
              />
              Sensitive value
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-muted">
                Logging policy
              </span>
              <select
                value={loggingPolicy}
                onChange={(event) =>
                  setLoggingPolicy(event.target.value as FactLoggingPolicy)
                }
                className="h-10 w-full rounded border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              >
                {LOGGING_POLICIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
              {isEdit ? 'Save fact' : 'Create fact'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
