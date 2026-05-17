import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

export function TablesSection() {
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const logic = useLogicStore((s) => s.logic);
  const addTable = useLogicStore((s) => s.addTable);
  const deleteTable = useLogicStore((s) => s.deleteTable);
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
    <div className="py-1 space-y-0.5">
      {tables.map((table) => (
        // biome-ignore lint/a11y/useSemanticElements: contains a nested button, so outer element cannot be a button
        <div
          key={table.id}
          onClick={() => setSelectedTable(table.id)}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedTable(table.id)}
          role="button"
          tabIndex={0}
          className={cn(
            'flex items-center justify-between mx-3 px-2 py-1.5 rounded cursor-pointer text-sm group',
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
          <IconButton
            tone="danger"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget({ id: table.id, name: table.name });
            }}
            className="opacity-0 group-hover:opacity-100 shrink-0"
            title={t.deleteTable}
            aria-label={t.deleteTable}
          >
            <Trash2 />
          </IconButton>
        </div>
      ))}

      <button
        type="button"
        onClick={addTable}
        className="mx-3 mt-1 mb-1 w-[calc(100%-1.5rem)] flex items-center gap-1 px-2 py-1.5 text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded border border-dashed border-violet-300"
      >
        <Plus size={12} /> {t.addTable}
      </button>

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
