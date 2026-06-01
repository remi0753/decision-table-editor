import type { Logic } from '@leverie/engine';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { getSampleTemplates } from '@/lib/sampleTemplates';
import { useUiStore } from '@/store/uiStore';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFromSample: (logic: Logic) => void;
  onReplaceCurrent: (logic: Logic) => void;
}

export function SampleGalleryDialog({
  open,
  onOpenChange,
  onCreateFromSample,
  onReplaceCurrent,
}: Props) {
  const lang = useUiStore((s) => s.lang);
  const t = useT();
  const templates = getSampleTemplates(lang);

  const handleCreate = (templateId: string) => {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    onCreateFromSample(template.buildLogic());
    onOpenChange(false);
  };

  const handleReplace = (templateId: string) => {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    onReplaceCurrent(template.buildLogic());
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-lg shadow-xl w-[min(92vw,860px)] max-h-[88vh] z-50 flex flex-col">
          <div className="flex items-start justify-between p-5 border-b">
            <div>
              <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                <Sparkles size={18} className="text-brand-fg" />
                {t.sampleGalleryTitle}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-fg-muted mt-1">
                {t.sampleGalleryDescription}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t.close}
              className="p-1 -m-1 text-fg-faint hover:text-fg-secondary rounded"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <article
                key={tpl.id}
                className="border border-line rounded-lg p-4 flex flex-col hover:border-brand-border-strong hover:shadow-sm transition-colors bg-surface"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-brand-fg mb-1">
                  {tpl.industry}
                </div>
                <h3 className="text-base font-semibold text-fg">{tpl.name}</h3>
                <p className="text-sm text-fg-muted mt-2 leading-relaxed">
                  {tpl.summary}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-fg-muted">
                  {tpl.highlights.map((h) => (
                    <li key={h} className="flex gap-1.5">
                      <span className="text-brand-fg-mid">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleCreate(tpl.id)}
                    className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-strong"
                  >
                    {t.createFromSample}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReplace(tpl.id)}
                    className="rounded border border-line bg-surface px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-muted"
                  >
                    {t.replaceWithSample}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="px-5 py-3 border-t bg-surface-muted text-xs text-fg-subtle rounded-b-lg">
            {t.sampleGalleryFooter}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
