import { create } from 'zustand';
import type { Lang } from '@/i18n/translations';
import type { BatchCase, BatchCaseResult } from '@/types/batch';
import type { EvalResult } from '@/types/logic';

export type LeftPaneSectionKey = 'dag' | 'tables' | 'fields';

interface LeftPaneSections {
  dag: boolean;
  tables: boolean;
  fields: boolean;
}

interface UiStore {
  lang: Lang;
  setLang: (lang: Lang) => void;

  selectedTableId: string | null;
  setSelectedTable: (tableId: string) => void;

  leftPaneSections: LeftPaneSections;
  toggleLeftPaneSection: (key: LeftPaneSectionKey) => void;

  evalDrawerOpen: boolean;
  setEvalDrawerOpen: (open: boolean) => void;
  toggleEvalDrawer: () => void;

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

const PREFS_KEY = 'leverie-ui-prefs';

interface PersistedPrefs {
  leftPaneSections: LeftPaneSections;
  evalDrawerOpen: boolean;
}

const DEFAULT_PREFS: PersistedPrefs = {
  leftPaneSections: { dag: true, tables: true, fields: true },
  evalDrawerOpen: false,
};

const loadPrefs = (): PersistedPrefs => {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      leftPaneSections: {
        dag:
          parsed?.leftPaneSections?.dag ?? DEFAULT_PREFS.leftPaneSections.dag,
        tables:
          parsed?.leftPaneSections?.tables ??
          DEFAULT_PREFS.leftPaneSections.tables,
        fields:
          parsed?.leftPaneSections?.fields ??
          DEFAULT_PREFS.leftPaneSections.fields,
      },
      evalDrawerOpen: parsed?.evalDrawerOpen ?? DEFAULT_PREFS.evalDrawerOpen,
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

const savePrefs = (prefs: PersistedPrefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
};

const storedLang =
  (typeof window !== 'undefined'
    ? (localStorage.getItem('leverie-lang') as Lang | null)
    : null) ?? 'en';

const initialPrefs = loadPrefs();

export const useUiStore = create<UiStore>((set) => ({
  lang: storedLang,
  setLang: (lang) => {
    localStorage.setItem('leverie-lang', lang);
    set({ lang });
  },

  selectedTableId: null,
  setSelectedTable: (selectedTableId) => set({ selectedTableId }),

  leftPaneSections: initialPrefs.leftPaneSections,
  toggleLeftPaneSection: (key) =>
    set((s) => {
      const leftPaneSections = {
        ...s.leftPaneSections,
        [key]: !s.leftPaneSections[key],
      };
      savePrefs({ leftPaneSections, evalDrawerOpen: s.evalDrawerOpen });
      return { leftPaneSections };
    }),

  evalDrawerOpen: initialPrefs.evalDrawerOpen,
  setEvalDrawerOpen: (evalDrawerOpen) =>
    set((s) => {
      savePrefs({ leftPaneSections: s.leftPaneSections, evalDrawerOpen });
      return { evalDrawerOpen };
    }),
  toggleEvalDrawer: () =>
    set((s) => {
      const evalDrawerOpen = !s.evalDrawerOpen;
      savePrefs({ leftPaneSections: s.leftPaneSections, evalDrawerOpen });
      return { evalDrawerOpen };
    }),

  evalInputs: {},
  setEvalInput: (fieldId, value) =>
    set((s) => ({ evalInputs: { ...s.evalInputs, [fieldId]: value } })),
  clearEvalInputs: () => set({ evalInputs: {} }),

  evalResult: null,
  setEvalResult: (evalResult) => set({ evalResult }),
  clearEvalResult: () => set({ evalResult: null }),

  batchFileName: null,
  batchCases: [],
  batchResults: null,
  setBatchData: (batchFileName, batchCases) =>
    set({ batchFileName, batchCases, batchResults: null }),
  setBatchResults: (batchResults) => set({ batchResults }),
  clearBatch: () =>
    set({ batchFileName: null, batchCases: [], batchResults: null }),
}));
