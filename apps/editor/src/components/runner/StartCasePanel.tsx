import { ClipboardPaste, Loader2, Play } from 'lucide-react';
import { useState } from 'react';

// Start-case intake (§8.2): one paste box that leads the operator to paste the
// business key (order number, ticket URL, copied details), not structured JSON.
export function StartCasePanel({
  onStart,
  starting,
}: {
  onStart: (text: string) => void;
  starting: boolean;
}) {
  const [text, setText] = useState('');

  const handleClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText(clip);
    } catch {
      // Clipboard permission denied — the operator can paste manually.
    }
  };

  return (
    <div className="rounded border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-fg">Start a case</h2>
      <p className="mt-1 text-sm leading-6 text-fg-muted">
        Paste an order number, ticket URL, or copied case details. LEVERIE will
        use the key to collect known facts.
      </p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        placeholder={'Order #12345\nCustomer tier: Gold'}
        className="mt-3 w-full rounded border border-line px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => void handleClipboard()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-line px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
        >
          <ClipboardPaste className="h-4 w-4" />
          Use clipboard
        </button>
        <button
          type="button"
          onClick={() => onStart(text)}
          disabled={starting || !text.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-brand px-5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Start
        </button>
      </div>
    </div>
  );
}
