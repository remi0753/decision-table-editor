import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { DagGraph } from '@/components/graph/DagGraph';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

export function LeftPane() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const logic = useLogicStore(s => s.logic);
  const addTable = useLogicStore(s => s.addTable);
  const deleteTable = useLogicStore(s => s.deleteTable);
  const selectedTableId = useUiStore(s => s.selectedTableId);
  const setSelectedTable = useUiStore(s => s.setSelectedTable);

  const tables = Object.values(logic.tables);

  const handleDelete = () => {
    if (!deleteTarget) return;
    const result = deleteTable(deleteTarget.id);
    if (result.error) toast.error(result.error);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col h-full">
      <DagGraph />

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-xs text-gray-400 px-2 py-1">テーブル一覧</div>
        {tables.map(table => (
          <div
            key={table.id}
            onClick={() => setSelectedTable(table.id)}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm group',
              selectedTableId === table.id
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-gray-100 text-gray-700',
            )}
          >
            <div className="flex items-center gap-1 min-w-0">
              {logic.entryTableId === table.id && <span className="text-blue-500 text-xs shrink-0">▶</span>}
              <span className="truncate">{table.name}</span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setDeleteTarget({ id: table.id, name: table.name }); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        <button
          onClick={addTable}
          className="w-full flex items-center gap-1 px-3 py-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-dashed border-blue-300"
        >
          <Plus size={12} /> テーブルを追加
        </button>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="テーブルを削除"
        description={`「${deleteTarget?.name}」を削除しますか？`}
        confirmLabel="削除"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
