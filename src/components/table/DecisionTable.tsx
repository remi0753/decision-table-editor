import { useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Settings } from 'lucide-react';
import { useLogicStore } from '@/store/logicStore';
import { useQualityChecks } from '@/hooks/useQualityChecks';
import { ColumnHeader } from './ColumnHeader';
import { SortableRow } from './RowHandle';
import { OutputColsPanel } from './OutputColsPanel';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { toast } from 'sonner';

interface Props {
  tableId: string;
}

export function DecisionTable({ tableId }: Props) {
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const logic = useLogicStore(s => s.logic);
  const addCol = useLogicStore(s => s.addCol);
  const addRow = useLogicStore(s => s.addRow);
  const moveRow = useLogicStore(s => s.moveRow);
  const renameTable = useLogicStore(s => s.renameTable);
  const setEntryTable = useLogicStore(s => s.setEntryTable);

  const table = logic.tables[tableId];
  if (!table) return <div className="p-4 text-gray-400">テーブルが見つかりません。</div>;

  const { duplicates, unreachable, noDefault } = useQualityChecks(table);

  const rowIds = table.rows.map(r => r.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = table.rows.findIndex(r => r.id === active.id);
    const to = table.rows.findIndex(r => r.id === over.id);
    if (from !== -1 && to !== -1) moveRow(tableId, from, to);
  };

  const handleRename = (name: string) => {
    const result = renameTable(tableId, name);
    if (result.error) toast.error(result.error);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <InlineEdit value={table.name} onSave={handleRename} className="font-semibold text-sm" />
          {logic.entryTableId === tableId && (
            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded">▶ 入口</span>
          )}
          {logic.entryTableId !== tableId && (
            <button
              onClick={() => setEntryTable(tableId)}
              className="text-xs text-gray-400 hover:text-blue-600"
              title="このテーブルをエントリーポイントに設定"
            >
              入口に設定
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="border-b border-r bg-gray-50 w-8" />
              <th className="border-b border-r bg-gray-50 w-10 text-xs text-gray-400 px-2">#</th>
              {table.cols.map(col => (
                <ColumnHeader key={col.id} tableId={tableId} colId={col.id} fieldId={col.fieldId} />
              ))}
              <th className="border-b border-r bg-gray-50 px-2 py-1 text-xs font-medium relative" style={{ minWidth: 240 }}>
                <div className="flex items-center justify-between">
                  <span>結論</span>
                  <button
                    onClick={() => setShowOutputPanel(!showOutputPanel)}
                    className="text-gray-400 hover:text-gray-600"
                    title="出力列を管理"
                  >
                    <Settings size={12} />
                  </button>
                </div>
                {showOutputPanel && (
                  <OutputColsPanel
                    tableId={tableId}
                    outputCols={table.outputCols}
                    onClose={() => setShowOutputPanel(false)}
                  />
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
              <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                {table.rows.map((row, i) => (
                  <SortableRow
                    key={row.id}
                    tableId={tableId}
                    table={table}
                    row={row}
                    rowIndex={i}
                    totalRows={table.rows.length}
                    duplicateWarning={duplicates.has(row.id)}
                    unreachableWarning={unreachable.has(row.id)}
                    fieldDefs={logic.fieldDefs}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t flex items-center gap-2">
        <button
          onClick={() => addCol(tableId)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1"
        >
          <Plus size={12} /> 条件列を追加
        </button>
        <button
          onClick={() => addRow(tableId)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1"
        >
          <Plus size={12} /> 行を追加
        </button>
      </div>

      {noDefault && table.rows.length > 0 && (
        <div className="mx-4 mb-3 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
          ⚠️ どの条件にも当てはまるフォールバック行がありません。特定の入力値で結果が得られない場合があります。
        </div>
      )}
    </div>
  );
}
