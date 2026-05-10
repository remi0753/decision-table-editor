import { create } from 'zustand';
import { type EvalResult } from '@/types/logic';
import { type BatchCase, type BatchCaseResult } from '@/types/batch';

interface UiStore {
  selectedTableId: string | null;
  setSelectedTable: (tableId: string) => void;

  evalInputs: Record<string, string>;
  setEvalInput: (fieldId: string, value: string) => void;
  clearEvalInputs: () => void;

  evalResult: EvalResult | null;
  setEvalResult: (result: EvalResult | null) => void;
  clearEvalResult: () => void;

  batchFileName: string | null;
  batchCases: BatchCase[];
  batchResults: BatchCaseResult[] | null;
  setBatchData: (fileName: string, cases: BatchCase[]) => void;
  setBatchResults: (results: BatchCaseResult[]) => void;
  clearBatch: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selectedTableId: null,
  setSelectedTable: (selectedTableId) => set({ selectedTableId }),

  evalInputs: {},
  setEvalInput: (fieldId, value) => set(s => ({ evalInputs: { ...s.evalInputs, [fieldId]: value } })),
  clearEvalInputs: () => set({ evalInputs: {} }),

  evalResult: null,
  setEvalResult: (evalResult) => set({ evalResult }),
  clearEvalResult: () => set({ evalResult: null }),

  batchFileName: null,
  batchCases: [],
  batchResults: null,
  setBatchData: (batchFileName, batchCases) => set({ batchFileName, batchCases, batchResults: null }),
  setBatchResults: (batchResults) => set({ batchResults }),
  clearBatch: () => set({ batchFileName: null, batchCases: [], batchResults: null }),
}));
