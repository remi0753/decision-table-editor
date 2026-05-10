import { create } from 'zustand';

interface UiStore {
  selectedTableId: string | null;
  setSelectedTable: (tableId: string) => void;

  evalInputs: Record<string, string>;
  setEvalInput: (fieldId: string, value: string) => void;
  clearEvalInputs: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selectedTableId: null,
  setSelectedTable: (selectedTableId) => set({ selectedTableId }),

  evalInputs: {},
  setEvalInput: (fieldId, value) => set(s => ({ evalInputs: { ...s.evalInputs, [fieldId]: value } })),
  clearEvalInputs: () => set({ evalInputs: {} }),
}));
