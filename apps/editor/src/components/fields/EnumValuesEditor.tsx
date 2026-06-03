import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n/useT';

interface Props {
  enumValues: string[];
  onAdd: (value: string) => void;
  onRename: (oldValue: string, newValue: string) => void;
  onDelete: (value: string) => void;
}

export function EnumValuesEditor({
  enumValues,
  onAdd,
  onRename,
  onDelete,
}: Props) {
  const [newValue, setNewValue] = useState('');
  const t = useT();

  const handleAdd = () => {
    const v = newValue.trim();
    if (!v) return;
    if (enumValues.includes(v)) {
      toast.error(t.enumDuplicate(v));
      return;
    }
    onAdd(v);
    setNewValue('');
  };

  const handleRename = (oldV: string, newV: string) => {
    const trimmed = newV.trim();
    if (!trimmed || trimmed === oldV) return;
    if (enumValues.includes(trimmed)) {
      toast.error(t.enumDuplicate(trimmed));
      return;
    }
    onRename(oldV, trimmed);
  };

  return (
    <div className="flex flex-col gap-2">
      {enumValues.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {enumValues.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-0.5 bg-brand-subtle border border-brand-border rounded px-1.5 py-0.5 text-xs"
            >
              {/* biome-ignore lint/a11y/useSemanticElements: contentEditable span is intentional for inline tag editing */}
              <span
                role="textbox"
                tabIndex={0}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleRename(v, e.currentTarget.textContent ?? v)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className="outline-none min-w-4"
              >
                {v}
              </span>
              <button
                type="button"
                onClick={() => onDelete(v)}
                className="text-fg-faint hover:text-danger-fg ml-0.5"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={t.enumAddPlaceholder}
          className="h-7 min-w-0 flex-1 rounded border border-line bg-surface px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={newValue.trim().length === 0}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-brand-border bg-surface px-2 text-xs font-medium text-brand-fg hover:bg-brand-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={12} />
          {t.add}
        </button>
      </div>
    </div>
  );
}
