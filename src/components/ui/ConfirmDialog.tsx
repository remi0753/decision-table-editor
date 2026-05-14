import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useT } from '@/i18n/useT';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel,
  onConfirm, destructive = false,
}: Props) {
  const t = useT();
  const resolvedConfirm = confirmLabel ?? t.confirmDefault;
  const resolvedCancel = cancelLabel ?? t.cancelDefault;

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-50">
          <AlertDialog.Title className="text-base font-semibold mb-2">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-6 whitespace-pre-wrap">{description}</AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button className="px-4 py-2 rounded border text-sm hover:bg-gray-50">{resolvedCancel}</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded text-sm text-white ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}`}
              >
                {resolvedConfirm}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
