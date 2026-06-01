import type { Logic } from '@leverie/engine';
import * as Dialog from '@radix-ui/react-dialog';
import { FlaskConical, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { BatchPanel } from './BatchPanel';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logic: Logic;
}

export function BatchDialog({ open, onOpenChange, logic }: Props) {
  const t = useT();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-lg shadow-xl w-[min(95vw,1200px)] h-[min(90vh,820px)] z-50 flex flex-col">
          <div className="flex items-start justify-between p-5 border-b shrink-0">
            <div>
              <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                <FlaskConical size={18} className="text-brand-fg" />
                {t.batchDialogTitle}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-fg-muted mt-1 max-w-2xl">
                {t.batchDialogDescription}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t.close}
              className="p-1 -m-1 text-fg-faint hover:text-fg-secondary rounded"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <BatchPanel logic={logic} onInspect={() => onOpenChange(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
