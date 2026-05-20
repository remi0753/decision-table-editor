import type { Logic } from '@leverie/engine';
import { runBatchEvaluation } from '@leverie/engine';
import { Download, Play, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { downloadBatchTemplate } from '@/hooks/useImportExport';
import { useT } from '@/i18n/useT';
import { parseBatchCsv } from '@/lib/parseCsv';
import { useUiStore } from '@/store/uiStore';
import { BatchResultTable } from './BatchResultTable';

interface Props {
  logic: Logic;
  onInspect?: () => void;
}

export function BatchPanel({ logic, onInspect }: Props) {
  const batchFileName = useUiStore((s) => s.batchFileName);
  const batchCases = useUiStore((s) => s.batchCases);
  const batchResults = useUiStore((s) => s.batchResults);
  const setBatchData = useUiStore((s) => s.setBatchData);
  const setBatchResults = useUiStore((s) => s.setBatchResults);
  const clearBatch = useUiStore((s) => s.clearBatch);
  const t = useT();

  const handleLoadCsv = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const { cases, warnings } = parseBatchCsv(text, logic, t);
        if (cases.length === 0) {
          toast.error(warnings[0] ?? t.noCasesLoaded);
          return;
        }
        setBatchData(file.name, cases);
        if (warnings.length > 0) {
          toast.warning(warnings[0]);
        } else {
          toast.success(t.casesLoaded(cases.length));
        }
      } catch {
        toast.error(t.csvLoadError);
      }
    };
    input.click();
  };

  const handleRunAll = () => {
    const results = runBatchEvaluation(batchCases, logic);
    setBatchResults(results);
  };

  const noFields = Object.keys(logic.fieldDefs).length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleLoadCsv}
          className="flex items-center gap-1.5 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-700"
        >
          <Upload size={14} /> {t.loadCsv}
        </button>
        <button
          type="button"
          onClick={() => downloadBatchTemplate(logic)}
          disabled={noFields}
          className="flex items-center gap-1.5 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} /> {t.downloadTemplate}
        </button>
      </div>

      {noFields && <p className="text-xs text-gray-400">{t.noFields}</p>}

      {batchFileName && (
        <p className="text-xs text-gray-500">
          {t.loadedFile(batchFileName, batchCases.length)}
        </p>
      )}

      {batchCases.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRunAll}
            className="flex items-center gap-1.5 bg-violet-600 text-white text-sm px-3 py-1.5 rounded hover:bg-violet-700"
          >
            <Play size={14} /> {t.runAll}
          </button>
          <button
            type="button"
            onClick={clearBatch}
            className="flex items-center gap-1.5 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-600"
          >
            <RotateCcw size={14} /> {t.clear}
          </button>
        </div>
      )}

      {batchResults && (
        <div className="border-t pt-3">
          <BatchResultTable
            results={batchResults}
            logic={logic}
            onInspect={onInspect}
          />
        </div>
      )}
    </div>
  );
}
