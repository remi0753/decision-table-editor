import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { type Row, type Table, type FieldDef } from '@/types/logic';
import { useLogicStore } from '@/store/logicStore';
import { CellEditor } from './CellEditor';
import { ConclusionCell } from './ConclusionCell';
import { cn } from '@/lib/utils';

interface Props {
  tableId: string;
  table: Table;
  row: Row;
  rowIndex: number;
  totalRows: number;
  duplicateWarning: boolean;
  unreachableWarning: boolean;
  fieldDefs: Record<string, FieldDef>;
}

export function SortableRow({
  tableId, table, row, rowIndex, totalRows, duplicateWarning, unreachableWarning, fieldDefs,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const setCell = useLogicStore(s => s.setCell);
  const clearCell = useLogicStore(s => s.clearCell);
  const deleteRow = useLogicStore(s => s.deleteRow);
  const moveRow = useLogicStore(s => s.moveRow);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={cn('group hover:bg-gray-50', isDragging && 'bg-blue-50')}>
      <td className="border-b border-r px-1 py-0.5 w-8 text-center">
        <div className="flex flex-col items-center gap-0.5">
          {(duplicateWarning || unreachableWarning) && (
            <span
              className={cn(
                'text-xs font-bold leading-none px-1 rounded',
                unreachableWarning ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700',
              )}
              title={unreachableWarning ? 'この行はどの入力でも到達できません。' : 'この行は上の行と同じ条件です。'}
            >
              !
            </span>
          )}
          <button
            {...attributes}
            {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={12} />
          </button>
        </div>
      </td>
      <td className="border-b border-r px-2 py-0.5 text-xs text-gray-400 text-center w-10">{rowIndex + 1}</td>
      {table.cols.map(col => {
        const field = col.fieldId ? (fieldDefs[col.fieldId] ?? null) : null;
        return (
          <td key={col.id} className="border-b border-r p-0 h-8" style={{ width: 160 }}>
            <CellEditor
              cell={row.cells[col.id]}
              field={field}
              onSave={cell => setCell(tableId, row.id, col.id, cell)}
              onClear={() => clearCell(tableId, row.id, col.id)}
            />
          </td>
        );
      })}
      <td className="border-b border-r p-0 h-8" style={{ minWidth: 240 }}>
        <ConclusionCell
          tableId={tableId}
          rowId={row.id}
          conclusion={row.conclusion}
          outputCols={table.outputCols}
        />
      </td>
      <td className="border-b px-1 py-0.5 w-8 text-center">
        <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 gap-0.5">
          <button onClick={() => rowIndex > 0 && moveRow(tableId, rowIndex, rowIndex - 1)} disabled={rowIndex === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-20"><ArrowUp size={10} /></button>
          <button onClick={() => deleteRow(tableId, row.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
          <button onClick={() => rowIndex < totalRows - 1 && moveRow(tableId, rowIndex, rowIndex + 1)} disabled={rowIndex === totalRows - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-20"><ArrowDown size={10} /></button>
        </div>
      </td>
    </tr>
  );
}
