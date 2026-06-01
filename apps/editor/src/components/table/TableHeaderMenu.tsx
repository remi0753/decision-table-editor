import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogIn, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';

interface Props {
  tableId: string;
}

export function TableHeaderMenu({ tableId }: Props) {
  const t = useT();
  const table = useLogicStore((s) => s.logic.tables[tableId]);
  const isEntry = useLogicStore((s) => s.logic.entryTableId === tableId);
  const setEntryTable = useLogicStore((s) => s.setEntryTable);
  const deleteAllRows = useLogicStore((s) => s.deleteAllRows);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!table) return null;

  const rowCount = table.rows.length;
  const canDeleteAllRows = rowCount > 0;

  const handleDeleteAllRows = () => {
    deleteAllRows(tableId);
    setConfirmOpen(false);
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton
            size="xs"
            title={t.tableMoreActions}
            aria-label={t.tableMoreActions}
          >
            <MoreVertical />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="min-w-[180px] bg-surface border border-line rounded-md shadow-lg p-1 z-50"
          >
            <DropdownMenu.Item
              disabled={isEntry}
              onSelect={() => setEntryTable(tableId)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-fg-secondary rounded cursor-pointer outline-none data-[highlighted]:bg-brand-subtle data-[highlighted]:text-brand-fg-strong data-[disabled]:text-fg-faint data-[disabled]:cursor-not-allowed data-[disabled]:data-[highlighted]:bg-transparent"
            >
              <LogIn size={14} />
              <span>{t.setEntry}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-surface-subtle" />
            <DropdownMenu.Item
              disabled={!canDeleteAllRows}
              onSelect={(e) => {
                e.preventDefault();
                setConfirmOpen(true);
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-danger-fg rounded cursor-pointer outline-none data-[highlighted]:bg-danger-bg data-[disabled]:text-fg-faint data-[disabled]:cursor-not-allowed data-[disabled]:data-[highlighted]:bg-transparent"
            >
              <Trash2 size={14} />
              <span>{t.deleteAllRows}</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.deleteAllRows}
        description={t.deleteAllRowsConfirm(table.name, rowCount)}
        confirmLabel={t.deleteAllRows}
        destructive
        onConfirm={handleDeleteAllRows}
      />
    </>
  );
}
