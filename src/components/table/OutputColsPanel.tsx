import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { type OutputCol } from '@/types/logic';
import { useLogicStore } from '@/store/logicStore';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useT } from '@/i18n/useT';

interface Props {
  tableId: string;
  outputCols: OutputCol[];
  onClose: () => void;
}

export function OutputColsPanel({ tableId, outputCols, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const addOutputCol = useLogicStore(s => s.addOutputCol);
  const renameOutputCol = useLogicStore(s => s.renameOutputCol);
  const deleteOutputCol = useLogicStore(s => s.deleteOutputCol);
  const t = useT();

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addOutputCol(tableId, name);
    setNewName('');
  };

  const handleDelete = (ocolId: string) => {
    const result = deleteOutputCol(tableId, ocolId);
    if (result.error) toast.error(result.error);
  };

  return (
    <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg p-3 w-64 z-30 space-y-2">
      <div className="text-xs font-medium text-gray-600 mb-2">{t.manageOutputColsTitle}</div>
      {outputCols.map(oc => (
        <div key={oc.id} className="flex items-center gap-2 group">
          <InlineEdit
            value={oc.name}
            onSave={name => renameOutputCol(tableId, oc.id, name)}
            className="text-sm flex-1"
          />
          <button
            onClick={() => handleDelete(oc.id)}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div className="flex gap-1 pt-1 border-t">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') handleAdd(); }}
          placeholder={t.colNamePlaceholder}
          className="flex-1 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        <button onClick={handleAdd} className="text-violet-600 hover:text-violet-800">
          <Plus size={14} />
        </button>
      </div>
      <button onClick={onClose} className="w-full text-xs text-gray-500 hover:text-gray-700 pt-1 border-t">{t.close}</button>
    </div>
  );
}
