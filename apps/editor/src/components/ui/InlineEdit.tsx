import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

export function InlineEdit({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          'border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring',
          inputClassName,
        )}
        placeholder={placeholder}
      />
    );
  }

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        'cursor-pointer hover:bg-surface-subtle rounded px-1 py-0.5 text-left',
        className,
      )}
      title="クリックして編集"
    >
      {value || <span className="text-fg-faint">{placeholder}</span>}
    </button>
  );
}
