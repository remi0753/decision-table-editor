import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useT } from '@/i18n/useT';

// Standalone confirmation modal for deleting a logic. Presentational only: the
// caller owns the delete request and its `deleting` state, so the same dialog
// backs both the logic list (delete any row) and the header menu (delete the
// current logic). Renders above the logic switcher dialog, so its z-index sits
// one layer higher.
export function DeleteLogicDialog({
  open,
  onOpenChange,
  logicName,
  hasProduction,
  deleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logicName: string;
  hasProduction: boolean;
  deleting: boolean;
  onConfirm: () => void;
}) {
  const t = useT();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-surface shadow-xl">
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger-fg">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-fg">
                  {t.deleteLogicTitle}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-5 text-fg-secondary">
                  {t.deleteLogicConfirm(logicName)}
                </Dialog.Description>
              </div>
            </div>
            {hasProduction ? (
              <p className="flex items-start gap-1.5 rounded border border-danger-border bg-danger-bg p-2 text-xs leading-5 text-danger-fg">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t.deleteLogicProductionWarning}</span>
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-line p-3">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={deleting}
                className="h-9 rounded border border-line bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted disabled:opacity-50"
              >
                {t.cancel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded bg-danger px-3 text-sm font-medium text-white hover:bg-danger disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t.deleteLogicConfirmButton}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
