import { Trash2 } from 'lucide-react';
import { useLogicStore } from '@/store/logicStore';
import { useT } from '@/i18n/useT';

interface Props {
  tableId: string;
  colId: string;
  fieldId: string | null;
}

export function ColumnHeader({ tableId, colId, fieldId }: Props) {
  const logic = useLogicStore(s => s.logic);
  const setColField = useLogicStore(s => s.setColField);
  const deleteCol = useLogicStore(s => s.deleteCol);
  const t = useT();

  const fields = Object.values(logic.fieldDefs);

  return (
    <th className="border-b border-r bg-gray-50 px-2 py-1 text-xs font-medium min-w-40" style={{ width: 160 }}>
      <div className="flex items-center gap-1">
        <select
          value={fieldId ?? ''}
          onChange={e => setColField(tableId, colId, e.target.value || null)}
          className="flex-1 text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
        >
          <option value="">{t.noFieldSelected}</option>
          {fields.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button
          onClick={() => deleteCol(tableId, colId)}
          className="text-gray-300 hover:text-red-500 shrink-0"
          title={t.deleteColumn}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </th>
  );
}
