export type UiRuntimeLang = 'en' | 'ja';

export interface UiRuntimeTranslations {
  noFields: string;
  unset: string;
  noSelection: string;
  yes: string;
  no: string;
  inputPlaceholder: (fieldName: string) => string;

  traceLabel: string;
  traceStepTitle: (depth: number, tableName: string) => string;
  conditionNotMet: (fieldName: string) => string;
  conditionNotMetGeneral: string;
  rowMatched: (rowNum: number) => string;
  noMatchInTable: string;

  evalSuccess: string;
  evalNoMatch: string;
  noMatchAny: string;
  noMatchInRef: (tableName: string) => string;
}

const en: UiRuntimeTranslations = {
  noFields: 'No fields defined.',
  unset: '(unset)',
  noSelection: '(none)',
  yes: 'Yes',
  no: 'No',
  inputPlaceholder: (name) => `Enter ${name}`,

  traceLabel: 'Execution Trace',
  traceStepTitle: (depth, tableName) =>
    `[Step ${depth}] Evaluating "${tableName}"`,
  conditionNotMet: (fieldName) => `${fieldName}: condition not met → skip`,
  conditionNotMetGeneral: 'Condition not met → skip',
  rowMatched: (rowNum) => `Row ${rowNum}: → Matched ✓`,
  noMatchInTable: 'No matching row found.',

  evalSuccess: '✓ Result',
  evalNoMatch: '✗ No match',
  noMatchAny: 'No rules matched. Please check your conditions.',
  noMatchInRef: (tableName) =>
    `No matching rule in referenced table "${tableName}".`,
};

const ja: UiRuntimeTranslations = {
  noFields: 'フィールドが定義されていません。',
  unset: '（未設定）',
  noSelection: '（未選択）',
  yes: 'はい',
  no: 'いいえ',
  inputPlaceholder: (name) => `${name}を入力`,

  traceLabel: '実行トレース',
  traceStepTitle: (depth, tableName) =>
    `[ステップ${depth}] 「${tableName}」を評価`,
  conditionNotMet: (fieldName) => `${fieldName}: 条件不一致 → スキップ`,
  conditionNotMetGeneral: '条件不一致 → スキップ',
  rowMatched: (rowNum) => `${rowNum} 行目: → マッチ ✓`,
  noMatchInTable: 'マッチする行が見つかりませんでした。',

  evalSuccess: '✓ 結果',
  evalNoMatch: '✗ マッチなし',
  noMatchAny: 'どのルールにもマッチしませんでした。条件を確認してください。',
  noMatchInRef: (tableName) =>
    `参照先テーブル「${tableName}」でマッチするルールがありませんでした。`,
};

export const defaultTranslations: Record<UiRuntimeLang, UiRuntimeTranslations> =
  { en, ja };
