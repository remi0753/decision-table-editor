import { create } from 'zustand';
import { type EvalResult } from '@/types/logic';

interface UiStore {
  selectedTableId: string | null;
  setSelectedTable: (tableId: string) => void;

  evalInputs: Record<string, string>;
  setEvalInput: (fieldId: string, value: string) => void;
  clearEvalInputs: () => void;

  evalResult: EvalResult | null;
  setEvalResult: (result: EvalResult | null) => void;
  clearEvalResult: () => void;
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
}));
