import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import type { FieldDef, Row, Table } from '@/types/logic';
import { CellEditor } from './CellEditor';
import { ConclusionCell } from './ConclusionCell';

function focusFirstCellOfRow(rowId: string) {
  requestAnimationFrame(() => {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    const trigger = row?.querySelector<HTMLElement>('[data-cell-trigger]');
    trigger?.focus();
  });
}

interface Props {
  tableId: string;
  table: Table;
  row: Row;
  rowIndex: number;
  totalRows: number;
  duplicateWarning: boolean;
  unreachableWarning: boolean;
  fieldDefs: Record<string, FieldDef>;
  highlighted?: boolean;
}

export function SortableRow({
  tableId,
  table,
  row,
  rowIndex,
  totalRows,
  duplicateWarning,
  unreachableWarning,
  fieldDefs,
  highlighted,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });
  const setCell = useLogicStore((s) => s.setCell);
  const clearCell = useLogicStore((s) => s.clearCell);
  const deleteRow = useLogicStore((s) => s.deleteRow);
  const duplicateRow = useLogicStore((s) => s.duplicateRow);
  const moveRow = useLogicStore((s) => s.moveRow);
  const addRow = useLogicStore((s) => s.addRow);
  const insertRowAfter = useLogicStore((s) => s.insertRowAfter);
  const t = useT();

  const isLastRow = rowIndex === totalRows - 1;

  const handleInsertBelow = () => {
    const newId = insertRowAfter(tableId, row.id);
    if (newId) focusFirstCellOfRow(newId);
  };

  const handleAdvanceFromLastRow = () => {
    const newId = addRow(tableId);
    if (newId) focusFirstCellOfRow(newId);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      data-row-id={row.id}
      style={style}
      className={cn(
        'group hover:bg-gray-50',
        isDragging && 'bg-violet-50',
        highlighted && 'bg-yellow-50',
      )}
    >
      <td className="border-b border-r px-1 py-0.5 w-8 text-center relative">
        <div className="flex flex-col items-center gap-0.5">
          {(duplicateWarning || unreachableWarning) && (
            <span
              className={cn(
                'text-xs font-bold leading-none px-1 rounded',
                unreachableWarning
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700',
              )}
              title={
                unreachableWarning ? t.unreachableRowTitle : t.duplicateRowTitle
              }
            >
              !
            </span>
          )}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleInsertBelow}
          title={t.insertRowBelow}
          aria-label={t.insertRowBelow}
          className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-white border border-violet-300 text-violet-600 rounded-full hover:bg-violet-50 flex items-center justify-center w-4 h-4"
        >
          <Plus size={10} strokeWidth={2.5} />
        </button>
      </td>
      <td className="border-b border-r px-2 py-0.5 text-xs text-gray-400 text-center w-10">
        {rowIndex + 1}
      </td>
      {table.cols.map((col) => {
        const field = col.fieldId ? (fieldDefs[col.fieldId] ?? null) : null;
        return (
          <td
            key={col.id}
            className="border-b border-r p-0 h-8"
            style={{ width: 160 }}
          >
            <CellEditor
              cell={row.cells[col.id]}
              field={field}
              onSave={(cell) => setCell(tableId, row.id, col.id, cell)}
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
          isLastRow={isLastRow}
          onAdvance={handleAdvanceFromLastRow}
        />
      </td>
      <td className="border-b px-1 py-0.5 w-8 text-center">
        <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 gap-0.5">
          <button
            type="button"
            onClick={() =>
              rowIndex > 0 && moveRow(tableId, rowIndex, rowIndex - 1)
            }
            disabled={rowIndex === 0}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-20"
          >
            <ArrowUp size={10} />
          </button>
          <button
            type="button"
            onClick={() => duplicateRow(tableId, row.id)}
            className="text-gray-400 hover:text-violet-600"
            title={t.duplicateRow}
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            onClick={() => deleteRow(tableId, row.id)}
            className="text-gray-400 hover:text-red-500"
            title={t.deleteRow}
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            onClick={() =>
              rowIndex < totalRows - 1 &&
              moveRow(tableId, rowIndex, rowIndex + 1)
            }
            disabled={rowIndex === totalRows - 1}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-20"
          >
            <ArrowDown size={10} />
          </button>
        </div>
      </td>
    </tr>
  );
}
