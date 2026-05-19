import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/useT';
import { getSampleTemplates } from '@/lib/sampleTemplates';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SampleGalleryDialog({ open, onOpenChange }: Props) {
  const lang = useUiStore((s) => s.lang);
  const importLogic = useLogicStore((s) => s.importLogic);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const setEvalDrawerOpen = useUiStore((s) => s.setEvalDrawerOpen);
  const clearEvalInputs = useUiStore((s) => s.clearEvalInputs);
  const clearEvalResult = useUiStore((s) => s.clearEvalResult);
  const clearBatch = useUiStore((s) => s.clearBatch);
  const t = useT();
  const templates = getSampleTemplates(lang);

  const handleLoad = (templateId: string) => {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    const logic = template.buildLogic();
    importLogic(logic);
    setSelectedTable(logic.entryTableId);
    clearEvalInputs();
    clearEvalResult();
    clearBatch();
    setEvalDrawerOpen(true);
    onOpenChange(false);
    toast.success(t.sampleLoaded(template.name));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-[min(92vw,860px)] max-h-[88vh] z-50 flex flex-col">
          <div className="flex items-start justify-between p-5 border-b">
            <div>
              <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                <Sparkles size={18} className="text-violet-600" />
                {t.sampleGalleryTitle}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 mt-1">
                {t.sampleGalleryDescription}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t.close}
              className="p-1 -m-1 text-gray-400 hover:text-gray-700 rounded"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <article
                key={tpl.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-col hover:border-violet-300 hover:shadow-sm transition-colors bg-white"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-violet-600 mb-1">
                  {tpl.industry}
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  {tpl.name}
                </h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {tpl.summary}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-gray-600">
                  {tpl.highlights.map((h) => (
                    <li key={h} className="flex gap-1.5">
                      <span className="text-violet-500">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleLoad(tpl.id)}
                  className="mt-4 bg-violet-600 text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-violet-700"
                >
                  {t.useSample}
                </button>
              </article>
            ))}
          </div>

          <div className="px-5 py-3 border-t bg-gray-50 text-xs text-gray-500 rounded-b-lg">
            {t.sampleGalleryFooter}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
