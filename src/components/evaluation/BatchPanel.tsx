import { Download, Play, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { type Logic } from '@/types/logic';
import { useUiStore } from '@/store/uiStore';
import { parseBatchCsv } from '@/lib/parseCsv';
import { runBatchEvaluation } from '@/engine/batch';
import { downloadBatchTemplate } from '@/hooks/useImportExport';
import { BatchResultTable } from './BatchResultTable';

interface Props {
  logic: Logic;
}

export function BatchPanel({ logic }: Props) {
  const batchFileName = useUiStore(s => s.batchFileName);
  const batchCases = useUiStore(s => s.batchCases);
  const batchResults = useUiStore(s => s.batchResults);
  const setBatchData = useUiStore(s => s.setBatchData);
  const setBatchResults = useUiStore(s => s.setBatchResults);
  const clearBatch = useUiStore(s => s.clearBatch);

  const handleLoadCsv = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const { cases, warnings } = parseBatchCsv(text, logic);
        if (cases.length === 0) {
          toast.error(warnings[0] ?? 'テストケースを読み込めませんでした。');
          return;
        }
        setBatchData(file.name, cases);
        if (warnings.length > 0) {
          toast.warning(warnings[0]);
        } else {
          toast.success(`${cases.length}件のテストケースを読み込みました。`);
        }
      } catch {
        toast.error('CSVファイルを読み込めませんでした。Excelで作成したCSVファイルを選択してください。');
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
          onClick={handleLoadCsv}
          className="flex items-center gap-1.5 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-700"
        >
          <Upload size={14} /> CSVを読み込む
        </button>
        <button
          onClick={() => downloadBatchTemplate(logic)}
          disabled={noFields}
          className="flex items-center gap-1.5 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} /> テンプレートをダウンロード
        </button>
      </div>

      {noFields && (
        <p className="text-xs text-gray-400">フィールドが定義されていません。</p>
      )}

      {batchFileName && (
        <p className="text-xs text-gray-500">
          読み込み済み: <span className="font-medium">{batchFileName}</span>（{batchCases.length}件）
        </p>
      )}

      {batchCases.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={handleRunAll}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700"
          >
            <Play size={14} /> すべて評価実行
          </button>
          <button
            onClick={clearBatch}
            className="flex items-center gap-1.5 border text-sm px-3 py-1.5 rounded hover:bg-gray-50 text-gray-600"
          >
            <RotateCcw size={14} /> クリア
          </button>
        </div>
      )}

      {batchResults && (
        <div className="border-t pt-3">
          <BatchResultTable results={batchResults} logic={logic} />
        </div>
      )}
    </div>
  );
}
