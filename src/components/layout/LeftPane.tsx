import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DagGraph } from '@/components/graph/DagGraph';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

export function LeftPane() {
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const logic = useLogicStore((s) => s.logic);
  const addTable = useLogicStore((s) => s.addTable);
  const deleteTable = useLogicStore((s) => s.deleteTable);
  const setLogicName = useLogicStore((s) => s.setLogicName);
  const selectedTableId = useUiStore((s) => s.selectedTableId);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const t = useT();

  const tables = Object.values(logic.tables);

  const handleDelete = () => {
    if (!deleteTarget) return;
    const result = deleteTable(deleteTarget.id);
    if (result.error) toast.error(result.error);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-3 pt-3 pb-2.5 shrink-0">
        <div className="text-xs text-gray-400 mb-1 font-medium tracking-wide">
          {t.logicNameLabel}
        </div>
        <InlineEdit
          value={logic.name}
          onSave={setLogicName}
          className="font-semibold text-gray-800 text-sm block w-full"
          inputClassName="text-sm w-full"
          placeholder={t.logicNamePlaceholder}
        />
      </div>

      <DagGraph />

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-xs text-gray-400 px-2 py-1">{t.tableList}</div>
        {tables.map((table) => (
          // biome-ignore lint/a11y/useSemanticElements: contains a nested button, so outer element cannot be a button
          <div
            key={table.id}
            onClick={() => setSelectedTable(table.id)}
            onKeyDown={(e) => e.key === 'Enter' && setSelectedTable(table.id)}
            role="button"
            tabIndex={0}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm group',
              selectedTableId === table.id
                ? 'bg-violet-100 text-violet-800'
                : 'hover:bg-gray-100 text-gray-700',
            )}
          >
            <div className="flex items-center gap-1 min-w-0">
              {logic.entryTableId === table.id && (
                <span className="text-violet-500 text-xs shrink-0">▶</span>
              )}
              <span className="truncate">{table.name}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget({ id: table.id, name: table.name });
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addTable}
          className="w-full flex items-center gap-1 px-3 py-2 text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded border border-dashed border-violet-300"
        >
          <Plus size={12} /> {t.addTable}
        </button>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.deleteTable}
        description={
          deleteTarget ? t.deleteTableConfirm(deleteTarget.name) : ''
        }
        confirmLabel={t.confirmDefault}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
