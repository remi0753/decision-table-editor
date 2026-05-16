import { Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';

interface Props {
  tableId: string;
  colId: string;
  fieldId: string | null;
}

export function ColumnHeader({ tableId, colId, fieldId }: Props) {
  const logic = useLogicStore((s) => s.logic);
  const setColField = useLogicStore((s) => s.setColField);
  const deleteCol = useLogicStore((s) => s.deleteCol);
  const t = useT();

  const fields = Object.values(logic.fieldDefs);

  return (
    <th
      className="border-b border-r bg-gray-50 px-2 py-1 text-xs font-medium min-w-40"
      style={{ width: 160 }}
    >
      <div className="flex items-center gap-1">
        <select
          value={fieldId ?? ''}
          onChange={(e) => setColField(tableId, colId, e.target.value || null)}
          className="flex-1 text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
        >
          <option value="">{t.noFieldSelected}</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <IconButton
          tone="danger"
          size="xs"
          onClick={() => deleteCol(tableId, colId)}
          title={t.deleteColumn}
          aria-label={t.deleteColumn}
          className="shrink-0"
        >
          <Trash2 />
        </IconButton>
      </div>
    </th>
  );
}
