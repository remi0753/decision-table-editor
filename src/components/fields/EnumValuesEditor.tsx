import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useLogicStore } from '@/store/logicStore';
import { useT } from '@/i18n/useT';

interface Props {
  fieldId: string;
  enumValues: string[];
}

export function EnumValuesEditor({ fieldId, enumValues }: Props) {
  const [newValue, setNewValue] = useState('');
  const addEnumValue = useLogicStore(s => s.addEnumValue);
  const renameEnumValue = useLogicStore(s => s.renameEnumValue);
  const deleteEnumValue = useLogicStore(s => s.deleteEnumValue);
  const t = useT();

  const handleAdd = () => {
    const v = newValue.trim();
    if (!v) return;
    if (enumValues.includes(v)) { toast.error(t.enumDuplicate(v)); return; }
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
    if (enumValues.includes(trimmed)) { toast.error(t.enumDuplicate(trimmed)); return; }
    renameEnumValue(fieldId, oldV, trimmed);
  };

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {enumValues.map(v => (
        <span key={v} className="inline-flex items-center gap-0.5 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 text-xs">
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={e => handleRename(v, e.currentTarget.textContent ?? v)}
            onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            className="outline-none min-w-4"
          >
            {v}
          </span>
          <button onClick={() => handleDelete(v)} className="text-gray-400 hover:text-red-500 ml-0.5">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={newValue}
        onChange={e => setNewValue(e.target.value)}
        onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') handleAdd(); }}
        placeholder={t.enumAddPlaceholder}
        className="border rounded px-1.5 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-violet-400"
      />
      <button onClick={handleAdd} className="text-xs text-violet-600 hover:underline">＋</button>
    </div>
  );
}
