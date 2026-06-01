import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';

interface Props {
  fieldId: string;
  enumValues: string[];
}

export function EnumValuesEditor({ fieldId, enumValues }: Props) {
  const [newValue, setNewValue] = useState('');
  const addEnumValue = useLogicStore((s) => s.addEnumValue);
  const renameEnumValue = useLogicStore((s) => s.renameEnumValue);
  const deleteEnumValue = useLogicStore((s) => s.deleteEnumValue);
  const t = useT();

  const handleAdd = () => {
    const v = newValue.trim();
    if (!v) return;
    if (enumValues.includes(v)) {
      toast.error(t.enumDuplicate(v));
      return;
    }
    addEnumValue(fieldId, v);
    setNewValue('');
  };

  const handleDelete = (v: string) => {
    const result = deleteEnumValue(fieldId, v);
    if (result.error) toast.error(result.error);
  };

  const handleRename = (oldV: string, newV: string) => {
    const trimmed = newV.trim();
    if (!trimmed || trimmed === oldV) return;
    if (enumValues.includes(trimmed)) {
      toast.error(t.enumDuplicate(trimmed));
      return;
    }
    renameEnumValue(fieldId, oldV, trimmed);
  };

  return (
    <div className="flex flex-wrap gap-1 items-center">
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
            onClick={() => handleDelete(v)}
            className="text-fg-faint hover:text-danger-fg ml-0.5"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={newValue}
        onChange={(e) => setNewValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') handleAdd();
        }}
        placeholder={t.enumAddPlaceholder}
        className="border rounded px-1.5 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-brand-ring"
      />
      <button
        type="button"
        onClick={handleAdd}
        className="text-xs text-brand-fg hover:underline"
      >
        ＋
      </button>
    </div>
  );
}
