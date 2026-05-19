import type { UiRuntimeTranslations } from '@leverie/ui-runtime';
import type { TranslationSet } from './translations';

export function toUiRuntimeTranslations(
  t: TranslationSet,
): UiRuntimeTranslations {
  return {
    noFields: t.noFields,
    unset: t.unset,
    noSelection: t.noSelection,
    yes: t.yes,
    no: t.no,
    inputPlaceholder: t.inputPlaceholder,
    traceLabel: t.traceLabel,
    traceStepTitle: t.traceStepTitle,
    conditionNotMet: t.conditionNotMet,
    conditionNotMetGeneral: t.conditionNotMetGeneral,
    rowMatched: t.rowMatched,
    noMatchInTable: t.noMatchInTable,
    evalSuccess: t.evalSuccess,
    evalNoMatch: t.evalNoMatch,
    noMatchAny: t.noMatchAny,
    noMatchInRef: t.noMatchInRef,
  };
}
