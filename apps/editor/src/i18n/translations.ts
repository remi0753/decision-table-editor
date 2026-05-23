export type Lang = 'en' | 'ja';

export type TranslationSet = {
  // Initial data
  initialLogicName: string;
  initialTableName: (n: number) => string;
  initialOutputColName: string;

  // App
  newLogicCreated: string;

  // AppLayout
  newLogicConfirm: string;
  newCreate: string;
  importBtn: string;
  exportBtn: string;
  undo: string;
  redo: string;
  moreActions: string;
  fileActions: string;
  toolActions: string;
  accountMenu: string;
  accountSection: string;
  workspaceSection: string;
  organizationSection: string;
  signedInAs: string;
  localMode: string;
  langLabel: string;
  cloudChecking: string;
  cloudSaved: string;
  cloudSaving: string;
  cloudConflict: string;
  cloudError: string;
  cloudConnected: string;
  localSaved: string;
  localModeDescription: string;
  signIn: string;
  signUp: string;
  signOut: string;
  createAccount: string;
  useExistingAccount: string;
  publish: string;
  settings: string;
  share: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;

  // LeftPane
  logicNameLabel: string;
  logicNamePlaceholder: string;
  tableList: string;
  tableGraph: string;
  addTable: string;
  deleteTable: string;
  deleteTableConfirm: (name: string) => string;

  // RightPane
  selectTable: string;

  // FieldsSection
  fieldDefinitions: string;
  fieldNameRequired: string;
  fieldTypes: {
    string: string;
    number: string;
    bool: string;
    enum: string;
    date: string;
    datetime: string;
  };
  fieldNamePlaceholder: string;
  add: string;
  deleteField: string;
  deleteFieldConfirm: (name: string) => string;
  changeFieldType: string;
  changeFieldTypeConfirm: (count: number) => string;
  changeConfirm: string;
  importFieldDefs: string;
  importFieldDefsTitle: string;
  exportFieldDefs: string;
  exportFieldDefsTitle: string;
  fieldDefsImportSuccess: (added: number) => string;
  fieldDefsImportSuccessWithSkip: (added: number, skipped: string[]) => string;
  fieldDefsImportEmpty: string;

  // DecisionTable
  tableNotFound: string;
  entryBadge: string;
  setEntry: string;
  setEntryTitle: string;
  tableTab: string;
  flowchartTab: string;
  conclusion: string;
  manageOutputCols: string;
  addConditionCol: string;
  addRow: string;
  addFirstRow: string;
  addFirstConditionCol: string;
  emptyTableHelper: string;
  coverageGapWarning: (n: number) => string;
  viewInFlowchart: string;
  phantomNodeTitle: string;
  flowchartDeadendLabel: string;
  tableMoreActions: string;
  deleteAllRows: string;
  deleteAllRowsConfirm: (tableName: string, count: number) => string;

  // ColumnHeader
  noFieldSelected: string;
  deleteColumn: string;
  reorderColumn: string;

  // OutputColsPanel
  manageOutputColsTitle: string;
  colNamePlaceholder: string;
  close: string;

  // RowHandle
  unreachableRowTitle: string;
  duplicateRowTitle: string;
  unreachableRowTooltip: string;
  duplicateRowTooltip: string;
  contradictoryRowTooltip: string;
  contradictoryRowCellHint: (
    fieldName: string,
    colA: string,
    colB: string,
  ) => string;
  rowWarningLabel: string;
  rowErrorLabel: string;
  duplicateRow: string;
  deleteRow: string;
  insertRowBelow: string;

  // CellEditor
  assignField: string;
  operatorLabel: string;
  setCell: string;
  wildcard: string;
  pleaseSelect: string;

  // ConclusionCell
  noOutput: string;
  terminalConclusion: string;
  continueRef: string;
  outputPlaceholder: string;
  refTable: string;
  circularRef: (name: string) => string;

  // cellUtils
  noCondition: string;
  yes: string;
  no: string;

  // BoolSelect
  boolSelectTrue: string;
  boolSelectFalse: string;

  // InInput
  tagInputPlaceholder: string;

  // EvaluationPanel
  evaluationPanel: string;
  singleEval: string;
  batchEval: string;
  runEval: string;
  reset: string;
  traceLabel: string;

  // InputForm
  noFields: string;
  unset: string;
  noSelection: string;
  inputPlaceholder: (name: string) => string;

  // BatchPanel
  loadCsv: string;
  downloadTemplate: string;
  noCasesLoaded: string;
  casesLoaded: (n: number) => string;
  csvLoadError: string;
  loadedFile: (name: string, n: number) => string;
  runAll: string;
  clear: string;

  // TraceView
  traceStepTitle: (depth: number, tableName: string) => string;
  conditionNotMet: (fieldName: string) => string;
  conditionNotMetGeneral: string;
  rowMatched: (rowNum: number) => string;
  noMatchInTable: string;
  evalSuccess: string;
  evalNoMatch: string;
  noMatchAny: string;
  noMatchInRef: (tableName: string) => string;

  // BatchResultTable
  totalCases: (n: number) => string;
  matchedCases: (n: number) => string;
  noMatchCases: (n: number) => string;
  withExpected: (n: number) => string;
  caseName: string;
  resultCol: string;
  expectedCol: string;
  matchedResult: string;
  noMatchResult: string;
  clickForTrace: string;
  batchTest: string;
  batchDialogTitle: string;
  batchDialogDescription: string;
  inspectInEditor: string;
  inspectInEditorTooltip: string;
  inspectInEditorFailHint: string;
  inspectInEditorPassHint: string;

  // ConfirmDialog defaults
  confirmDefault: string;
  cancelDefault: string;

  // Operator labels
  operatorLabels: Record<string, string>;

  // Flowchart
  flowchartStart: string;
  flowchartNoOutput: string;
  flowchartEmpty: string;
  flowchartAddRows: string;
  flowchartOpContains: string;
  flowchartOpStartsWith: string;
  flowchartOpEndsWith: string;

  // Store errors
  errMinOneTable: string;
  errCannotDeleteEntry: string;
  errTableReferenced: (refs: string) => string;
  errTableNameDuplicate: (name: string) => string;
  errFieldNameDuplicate: (name: string) => string;
  errFieldInUse: (fieldName: string, tables: string) => string;
  errEnumValueInUse: (value: string) => string;
  errTableNotFound: string;
  errMinOneOutputCol: string;

  // Import/export
  importSuccess: string;
  importRepaired: (messages: string) => string;
  importJsonInvalid: (msg: string) => string;
  importJsonParseFailed: string;
  repairResetContinue: string;
  repairAddedOutputCol: string;

  // Enum editor
  enumDuplicate: (v: string) => string;
  enumAddPlaceholder: string;

  // CSV / batch template
  csvCaseName: string;
  csvExpectedPrefix: string;
  csvTemplateFileSuffix: string;
  csvErrEmptyHeader: string;
  csvErrNoInputCols: string;
  csvErrNoCases: string;
  csvAutoCase: (n: number) => string;

  // Sample templates
  samples: string;
  samplesShort: string;
  sampleGalleryTitle: string;
  sampleGalleryDescription: string;
  sampleGalleryFooter: string;
  useSample: string;
  startFromSample: string;
  startFromSampleHint: string;
  sampleLoaded: (name: string) => string;
  orSeparator: string;
};

export const translations: Record<Lang, TranslationSet> = {
  en: {
    initialLogicName: 'New Logic',
    initialTableName: (n) => `Table ${n}`,
    initialOutputColName: 'Result',

    newLogicCreated: 'Created a new logic.',

    newLogicConfirm:
      'Close the current logic and create a new one?\nThe current logic is saved in the browser.',
    newCreate: 'New',
    importBtn: 'Import',
    exportBtn: 'Export',
    undo: 'Undo (⌘Z)',
    redo: 'Redo (⇧⌘Z)',
    moreActions: 'More actions',
    fileActions: 'File',
    toolActions: 'Tools',
    accountMenu: 'Account and workspace',
    accountSection: 'Account',
    workspaceSection: 'Workspace',
    organizationSection: 'Organization',
    signedInAs: 'Signed in as',
    localMode: 'Local mode',
    langLabel: 'EN',
    cloudChecking: 'Checking cloud session...',
    cloudSaved: 'Cloud saved',
    cloudSaving: 'Saving to cloud...',
    cloudConflict: 'Cloud conflict',
    cloudError: 'Cloud save failed',
    cloudConnected: 'Connected to cloud.',
    localSaved: 'Saved in this browser',
    localModeDescription:
      'Sign in to save drafts and published versions to your workspace.',
    signIn: 'Sign in',
    signUp: 'Sign up',
    signOut: 'Sign out',
    createAccount: 'Create account',
    useExistingAccount: 'Use existing',
    publish: 'Publish',
    settings: 'Settings',
    share: 'Share',
    namePlaceholder: 'Name',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',

    logicNameLabel: 'Logic Name',
    logicNamePlaceholder: 'Logic name',
    tableList: 'Tables',
    tableGraph: 'Table Graph',
    addTable: 'Add table',
    deleteTable: 'Delete table',
    deleteTableConfirm: (name) => `Delete "${name}"?`,

    selectTable: 'Select a table.',

    fieldDefinitions: 'Field Definitions',
    fieldNameRequired: 'Please enter a field name.',
    fieldTypes: {
      string: 'Text',
      number: 'Number',
      bool: 'Boolean',
      enum: 'Enum',
      date: 'Date',
      datetime: 'Datetime',
    },
    fieldNamePlaceholder: 'Field name',
    add: 'Add',
    deleteField: 'Delete field',
    deleteFieldConfirm: (name) => `Delete "${name}"?`,
    changeFieldType: 'Change field type',
    changeFieldTypeConfirm: (count) =>
      `Changing the type will reset ${count} condition(s) using this field. Continue?`,
    changeConfirm: 'Change',
    importFieldDefs: 'Import',
    importFieldDefsTitle: 'Import field definitions from JSON',
    exportFieldDefs: 'Export',
    exportFieldDefsTitle: 'Export field definitions as JSON',
    fieldDefsImportSuccess: (added) =>
      `Imported ${added} field${added === 1 ? '' : 's'}.`,
    fieldDefsImportSuccessWithSkip: (added, skipped) =>
      `Imported ${added} field${added === 1 ? '' : 's'}. Skipped duplicate name${skipped.length === 1 ? '' : 's'}: ${skipped.join(', ')}`,
    fieldDefsImportEmpty: 'No fields found in the file.',

    tableNotFound: 'Table not found.',
    entryBadge: '▶ Entry',
    setEntry: 'Set as entry',
    setEntryTitle: 'Set this table as the entry point',
    tableTab: 'Table',
    flowchartTab: 'Flowchart',
    conclusion: 'Conclusion',
    manageOutputCols: 'Manage output columns',
    addConditionCol: 'Add condition column',
    addRow: 'Add row',
    addFirstRow: 'Add the first row',
    addFirstConditionCol: 'Add the first condition column',
    emptyTableHelper:
      'This table is empty. Add a column and a row to get started.',
    coverageGapWarning: (n) =>
      `${n} input combination${n === 1 ? '' : 's'} produce no result.`,
    viewInFlowchart: 'View in flowchart',
    phantomNodeTitle: 'No rule defined for this branch',
    flowchartDeadendLabel: 'No rule',
    tableMoreActions: 'More actions',
    deleteAllRows: 'Delete all rows',
    deleteAllRowsConfirm: (tableName, count) =>
      `Delete all ${count} row${count === 1 ? '' : 's'} in "${tableName}"? This cannot be undone except via Undo.`,

    noFieldSelected: '(none)',
    deleteColumn: 'Delete column',
    reorderColumn: 'Reorder column',

    manageOutputColsTitle: 'Manage output columns',
    colNamePlaceholder: 'Column name',
    close: 'Close',

    unreachableRowTitle: 'This row cannot be reached by any input.',
    duplicateRowTitle: 'This row has the same condition as a row above.',
    unreachableRowTooltip:
      'Unreachable: another row already covers this input, so this row will never run. Change the conditions to make it reachable.',
    duplicateRowTooltip:
      'Duplicate: another row has the same conditions. Change the conditions or remove one of the rows.',
    contradictoryRowTooltip:
      'Contradiction: conditions in this row are mutually exclusive — no input can ever match it. Fix or clear the highlighted cells.',
    contradictoryRowCellHint: (fieldName, colA, colB) =>
      `Field "${fieldName}" is contradicted between ${colA} and ${colB}.`,
    rowWarningLabel: 'Row warning',
    rowErrorLabel: 'Row error',
    duplicateRow: 'Duplicate row',
    deleteRow: 'Delete row',
    insertRowBelow: 'Insert row below',

    assignField: 'Assign a field to this column.',
    operatorLabel: 'Operator',
    setCell: 'Set',
    wildcard: 'No condition (wildcard)',
    pleaseSelect: 'Select',

    noOutput: '(no output set)',
    terminalConclusion: 'Terminal',
    continueRef: 'Continue',
    outputPlaceholder: 'Output value',
    refTable: 'Reference table',
    circularRef: (name) => `${name} (circular)`,

    noCondition: '(no condition)',
    yes: 'Yes',
    no: 'No',

    boolSelectTrue: 'Yes (true)',
    boolSelectFalse: 'No (false)',

    tagInputPlaceholder: 'Type and press Enter',

    evaluationPanel: 'Evaluation Panel',
    singleEval: 'Single',
    batchEval: 'Batch',
    runEval: 'Evaluate',
    reset: 'Reset',
    traceLabel: 'Execution Trace',

    noFields: 'No fields defined.',
    unset: '(unset)',
    noSelection: '(none)',
    inputPlaceholder: (name) => `Enter ${name}`,

    loadCsv: 'Load CSV',
    downloadTemplate: 'Download template',
    noCasesLoaded: 'No test cases could be loaded.',
    casesLoaded: (n) => `Loaded ${n} test case(s).`,
    csvLoadError:
      'Failed to load CSV. Please select a CSV file created with Excel.',
    loadedFile: (name, n) => `Loaded: ${name} (${n} cases)`,
    runAll: 'Run all',
    clear: 'Clear',

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

    totalCases: (n) => `Total: ${n}`,
    matchedCases: (n) => `✓ Matched: ${n}`,
    noMatchCases: (n) => `✗ No match: ${n}`,
    withExpected: (n) => `With expected: ${n}`,
    caseName: 'Case name',
    resultCol: 'Result',
    expectedCol: 'Expected',
    matchedResult: '✓ Matched',
    noMatchResult: '✗ No match',
    clickForTrace: 'Click a row to view trace',
    batchTest: 'Batch test',
    batchDialogTitle: 'Batch test',
    batchDialogDescription:
      'Validate this logic against many cases at once. Upload a CSV, run all cases, then jump back to the table to fix anything that did not behave as expected.',
    inspectInEditor: 'Edit',
    inspectInEditorTooltip: 'Close this dialog and jump to the related rule',
    inspectInEditorFailHint:
      'No rule matched. Jump to the table where evaluation stopped to add a new rule.',
    inspectInEditorPassHint:
      'A rule matched. Jump to that row to review or adjust it.',

    confirmDefault: 'Confirm',
    cancelDefault: 'Cancel',

    operatorLabels: {
      '=': 'Equal to',
      '!=': 'Not equal to',
      '<': 'Less than',
      '<=': 'At most',
      '>': 'Greater than',
      '>=': 'At least',
      between: 'Between',
      contains: 'Contains',
      starts_with: 'Starts with',
      ends_with: 'Ends with',
      in: 'In',
      null: 'Is empty',
      before_today: 'Before today',
      today_or_before: 'Today or before',
      after_today: 'After today',
      today_or_after: 'Today or after',
    },

    flowchartStart: 'Start',
    flowchartNoOutput: '(no output)',
    flowchartEmpty: '(empty)',
    flowchartAddRows: 'Add rows to see the flowchart',
    flowchartOpContains: 'contains',
    flowchartOpStartsWith: 'starts with',
    flowchartOpEndsWith: 'ends with',

    errMinOneTable: 'At least one table is required.',
    errCannotDeleteEntry:
      'Cannot delete the entry table. Change the entry table first.',
    errTableReferenced: (refs) =>
      `This table is referenced by: ${refs}. Remove the references first.`,
    errTableNameDuplicate: (name) => `Table name "${name}" is already in use.`,
    errFieldNameDuplicate: (name) => `Field name "${name}" is already in use.`,
    errFieldInUse: (fieldName, tables) =>
      `"${fieldName}" is used in: ${tables}. Remove references first.`,
    errEnumValueInUse: (value) =>
      `Value "${value}" is used in some cells and cannot be deleted.`,
    errTableNotFound: 'Table not found.',
    errMinOneOutputCol: 'At least one output column is required.',

    importSuccess: 'Imported successfully.',
    importRepaired: (messages) => `Auto-repaired on import: ${messages}`,
    importJsonInvalid: (msg) => `Invalid JSON format: ${msg}`,
    importJsonParseFailed: 'Failed to parse JSON.',
    repairResetContinue:
      'Reset a continue reference whose target was not found.',
    repairAddedOutputCol:
      'Added a "Result" output column to a table that had none.',

    enumDuplicate: (v) => `"${v}" already exists.`,
    enumAddPlaceholder: 'Add...',

    csvCaseName: 'Case name',
    csvExpectedPrefix: 'Expected:',
    csvTemplateFileSuffix: '_testcases.csv',
    csvErrEmptyHeader:
      'Header row is empty. Please download the template to create your test cases.',
    csvErrNoInputCols:
      'No input columns found. Check that field names in the header match the logic fields.',
    csvErrNoCases: 'No test cases found. Please add data rows.',
    csvAutoCase: (n) => `Case ${n}`,

    samples: 'Sample templates',
    samplesShort: 'Samples',
    sampleGalleryTitle: 'Start from a sample',
    sampleGalleryDescription:
      'Pick a ready-made decision logic from a familiar business scenario, load it into the editor, and reach an evaluation in under five minutes.',
    sampleGalleryFooter:
      'Loading a sample replaces the current logic. Your previous logic stays in the browser only until you load or import something else.',
    useSample: 'Load this sample',
    startFromSample: 'Start from a sample',
    startFromSampleHint:
      'New here? Load a ready-made example (support routing, refunds, credit screening) to see a working decision logic in seconds.',
    sampleLoaded: (name) => `Loaded sample: ${name}`,
    orSeparator: 'or',
  },

  ja: {
    initialLogicName: '新しいロジック',
    initialTableName: (n) => `テーブル${n}`,
    initialOutputColName: '結果',

    newLogicCreated: '新しいロジックを作成しました。',

    newLogicConfirm:
      '現在のロジックを閉じて新しいロジックを作成しますか？\n現在のロジックはブラウザに保存されています。',
    newCreate: '新規作成',
    importBtn: 'インポート',
    exportBtn: 'エクスポート',
    undo: '元に戻す（⌘Z）',
    redo: 'やり直し（⇧⌘Z）',
    moreActions: 'その他の操作',
    fileActions: 'ファイル',
    toolActions: 'ツール',
    accountMenu: 'アカウントとワークスペース',
    accountSection: 'アカウント',
    workspaceSection: 'ワークスペース',
    organizationSection: '組織',
    signedInAs: 'サインイン中',
    localMode: 'ローカルモード',
    langLabel: '日本語',
    cloudChecking: 'クラウドセッションを確認中...',
    cloudSaved: 'クラウドに保存済み',
    cloudSaving: 'クラウドに保存中...',
    cloudConflict: 'クラウド側で競合',
    cloudError: 'クラウド保存に失敗',
    cloudConnected: 'クラウドに接続しました。',
    localSaved: 'このブラウザに保存中',
    localModeDescription:
      'サインインすると draft と公開バージョンをワークスペースに保存します。',
    signIn: 'サインイン',
    signUp: '登録',
    signOut: 'サインアウト',
    createAccount: '新規登録',
    useExistingAccount: '既存アカウント',
    publish: '公開',
    settings: '設定',
    share: '共有',
    namePlaceholder: '名前',
    emailPlaceholder: 'メール',
    passwordPlaceholder: 'パスワード',

    logicNameLabel: 'ロジック名',
    logicNamePlaceholder: 'ロジック名',
    tableList: 'テーブル一覧',
    tableGraph: 'テーブル関係図',
    addTable: 'テーブルを追加',
    deleteTable: 'テーブルを削除',
    deleteTableConfirm: (name) => `「${name}」を削除しますか？`,

    selectTable: 'テーブルを選択してください。',

    fieldDefinitions: 'フィールド定義',
    fieldNameRequired: 'フィールド名を入力してください。',
    fieldTypes: {
      string: 'テキスト',
      number: '数値',
      bool: '真偽値',
      enum: '選択肢',
      date: '日付',
      datetime: '日時',
    },
    fieldNamePlaceholder: 'フィールド名',
    add: '追加',
    deleteField: 'フィールドを削除',
    deleteFieldConfirm: (name) => `「${name}」を削除しますか？`,
    changeFieldType: 'フィールド型を変更',
    changeFieldTypeConfirm: (count) =>
      `型を変更すると、このフィールドを使用している${count}件の条件がリセットされます。続けますか？`,
    changeConfirm: '変更する',
    importFieldDefs: 'インポート',
    importFieldDefsTitle: 'フィールド定義をJSONから読み込む',
    exportFieldDefs: 'エクスポート',
    exportFieldDefsTitle: 'フィールド定義をJSONで書き出す',
    fieldDefsImportSuccess: (added) => `${added}件のフィールドを追加しました。`,
    fieldDefsImportSuccessWithSkip: (added, skipped) =>
      `${added}件のフィールドを追加しました。同名のためスキップ: ${skipped.join('、')}`,
    fieldDefsImportEmpty: 'ファイルにフィールドが見つかりませんでした。',

    tableNotFound: 'テーブルが見つかりません。',
    entryBadge: '▶ 入口',
    setEntry: '入口に設定',
    setEntryTitle: 'このテーブルをエントリーポイントに設定',
    tableTab: 'テーブル',
    flowchartTab: 'フローチャート',
    conclusion: '結論',
    manageOutputCols: '出力列を管理',
    addConditionCol: '条件列を追加',
    addRow: '行を追加',
    addFirstRow: '最初の行を追加',
    addFirstConditionCol: '最初の条件列を追加',
    emptyTableHelper:
      'このテーブルはまだ空です。列と行を追加して始めましょう。',
    coverageGapWarning: (n) => `${n}件の入力組み合わせで結果が得られません。`,
    viewInFlowchart: 'フローチャートで確認',
    phantomNodeTitle: 'このブランチには対応する行がありません',
    flowchartDeadendLabel: '未対応',
    tableMoreActions: 'その他の操作',
    deleteAllRows: '行をすべて削除',
    deleteAllRowsConfirm: (tableName, count) =>
      `「${tableName}」の行をすべて削除しますか？（${count}件）。Undoで元に戻せます。`,

    noFieldSelected: '（未選択）',
    deleteColumn: '列を削除',
    reorderColumn: '列を並び替え',

    manageOutputColsTitle: '出力列を管理',
    colNamePlaceholder: '列名',
    close: '閉じる',

    unreachableRowTitle: 'この行はどの入力でも到達できません。',
    duplicateRowTitle: 'この行は上の行と同じ条件です。',
    unreachableRowTooltip:
      '到達不能: 他の行に覆われているため、この行は決して実行されません。条件を変更してください。',
    duplicateRowTooltip:
      '重複: 他の行と同じ条件です。条件を変更するか、いずれかを削除してください。',
    contradictoryRowTooltip:
      '行内矛盾: この行の条件は互いに両立しないため、どんな入力でもマッチしません。ハイライトされたセルを修正または削除してください。',
    contradictoryRowCellHint: (fieldName, colA, colB) =>
      `フィールド「${fieldName}」が ${colA} と ${colB} で矛盾しています。`,
    rowWarningLabel: '行の警告',
    rowErrorLabel: '行のエラー',
    duplicateRow: '行を複製',
    deleteRow: '行を削除',
    insertRowBelow: 'この行の下に挿入',

    assignField: '列にフィールドを割り当ててください。',
    operatorLabel: '演算子',
    setCell: '設定',
    wildcard: '条件なし（ワイルドカード）',
    pleaseSelect: '選択してください',

    noOutput: '（出力未設定）',
    terminalConclusion: '終端結論',
    continueRef: '継続参照',
    outputPlaceholder: '出力値',
    refTable: '参照先テーブル',
    circularRef: (name) => `${name}（循環参照）`,

    noCondition: '（条件なし）',
    yes: 'はい',
    no: 'いいえ',

    boolSelectTrue: 'はい（true）',
    boolSelectFalse: 'いいえ（false）',

    tagInputPlaceholder: '入力してEnter',

    evaluationPanel: '評価パネル',
    singleEval: '単一評価',
    batchEval: 'バッチ評価',
    runEval: '評価実行',
    reset: 'リセット',
    traceLabel: '実行トレース',

    noFields: 'フィールドが定義されていません。',
    unset: '（未入力）',
    noSelection: '（未選択）',
    inputPlaceholder: (name) => `${name}を入力`,

    loadCsv: 'CSVを読み込む',
    downloadTemplate: 'テンプレートをダウンロード',
    noCasesLoaded: 'テストケースを読み込めませんでした。',
    casesLoaded: (n) => `${n}件のテストケースを読み込みました。`,
    csvLoadError:
      'CSVファイルを読み込めませんでした。Excelで作成したCSVファイルを選択してください。',
    loadedFile: (name, n) => `読み込み済み: ${name}（${n}件）`,
    runAll: 'すべて評価実行',
    clear: 'クリア',

    traceStepTitle: (depth, tableName) =>
      `[ステップ${depth}] テーブル「${tableName}」を評価`,
    conditionNotMet: (fieldName) => `${fieldName} の条件を満たさず → スキップ`,
    conditionNotMetGeneral: '条件を満たさず → スキップ',
    rowMatched: (rowNum) => `行${rowNum}: → マッチ ✓`,
    noMatchInTable: 'マッチする行がありませんでした。',
    evalSuccess: '✓ 評価結果',
    evalNoMatch: '✗ マッチなし',
    noMatchAny: 'どのルールにも一致しませんでした。条件を確認してください。',
    noMatchInRef: (tableName) =>
      `継続参照先のテーブル「${tableName}」でマッチするルールがありませんでした。`,

    totalCases: (n) => `合計 ${n}件`,
    matchedCases: (n) => `✓ マッチ ${n}件`,
    noMatchCases: (n) => `✗ 不一致 ${n}件`,
    withExpected: (n) => `期待値あり ${n}件`,
    caseName: 'ケース名',
    resultCol: '結果',
    expectedCol: '期待値',
    matchedResult: '✓ マッチ',
    noMatchResult: '✗ 不一致',
    clickForTrace: '行をクリックするとトレースを表示',
    batchTest: 'バッチテスト',
    batchDialogTitle: 'バッチテスト',
    batchDialogDescription:
      '複数ケースをまとめて検証します。CSVを読み込み、一括で評価し、想定どおりに動かなかったケースからテーブルに戻って修正できます。',
    inspectInEditor: '編集',
    inspectInEditorTooltip: 'このダイアログを閉じて、該当ルールに移動します',
    inspectInEditorFailHint:
      'マッチするルールがありませんでした。評価が止まったテーブルに移動して、ルールを追加してください。',
    inspectInEditorPassHint:
      'ルールにマッチしました。該当行に移動して内容を確認・修正できます。',

    confirmDefault: '確認',
    cancelDefault: 'キャンセル',

    operatorLabels: {
      '=': '等しい',
      '!=': '等しくない',
      '<': 'より小さい（未満）',
      '<=': '以下',
      '>': 'より大きい（超過）',
      '>=': '以上',
      between: '範囲内',
      contains: '含む',
      starts_with: 'から始まる',
      ends_with: 'で終わる',
      in: 'いずれかに一致',
      null: '値がない',
      before_today: '今日より前',
      today_or_before: '今日以前',
      after_today: '今日より後',
      today_or_after: '今日以降',
    },

    flowchartStart: '開始',
    flowchartNoOutput: '(出力なし)',
    flowchartEmpty: '(空)',
    flowchartAddRows: '行を追加するとフローチャートが表示されます',
    flowchartOpContains: '含む',
    flowchartOpStartsWith: '先頭一致',
    flowchartOpEndsWith: '末尾一致',

    errMinOneTable: 'テーブルは最低1つ必要です。',
    errCannotDeleteEntry:
      'エントリーテーブルは削除できません。先にエントリーテーブルを変更してください。',
    errTableReferenced: (refs) =>
      `このテーブルは「${refs}」から参照されています。先に参照を解除してください。`,
    errTableNameDuplicate: (name) =>
      `テーブル名「${name}」は既に使用されています。`,
    errFieldNameDuplicate: (name) =>
      `フィールド名「${name}」は既に使用されています。`,
    errFieldInUse: (fieldName, tables) =>
      `「${fieldName}」は以下のテーブルで使用されています。先に参照を解除してください：${tables}`,
    errEnumValueInUse: (value) =>
      `値「${value}」は使用中のセルがあるため削除できません。`,
    errTableNotFound: 'テーブルが見つかりません。',
    errMinOneOutputCol: '出力列は最低1つ必要です。',

    importSuccess: 'インポートしました。',
    importRepaired: (messages) =>
      `インポート時に自動修復を行いました: ${messages}`,
    importJsonInvalid: (msg) => `JSONの形式が正しくありません。${msg}`,
    importJsonParseFailed: 'JSONのパースに失敗しました。',
    repairResetContinue: '参照先が見つからない継続参照をリセットしました。',
    repairAddedOutputCol:
      '出力列が未定義のテーブルに「結果」列を追加しました。',

    enumDuplicate: (v) => `「${v}」は既に存在します。`,
    enumAddPlaceholder: '追加...',

    csvCaseName: 'ケース名',
    csvExpectedPrefix: '期待:',
    csvTemplateFileSuffix: '_テストケース.csv',
    csvErrEmptyHeader:
      'ヘッダー行が空です。テンプレートをダウンロードして作成してください。',
    csvErrNoInputCols:
      '入力値の列が見つかりませんでした。ヘッダーのフィールド名がロジックのフィールド名と一致しているか確認してください。',
    csvErrNoCases:
      'テストケースが1件もありません。データ行を追加してください。',
    csvAutoCase: (n) => `ケース${n}`,

    samples: 'サンプルテンプレート',
    samplesShort: 'サンプル',
    sampleGalleryTitle: 'サンプルから始める',
    sampleGalleryDescription:
      '業務でよくあるシナリオの決定ロジックを選んでエディタに読み込み、5 分以内に評価まで体験できます。',
    sampleGalleryFooter:
      'サンプルを読み込むと現在のロジックは置き換わります。元のロジックは別のサンプル / インポートで上書きされるまでブラウザに残っています。',
    useSample: 'このサンプルを読み込む',
    startFromSample: 'サンプルから始める',
    startFromSampleHint:
      '初めての方はこちら。サポート振り分け・返金可否・与信スクリーニングなど、すぐ動く実例をワンクリックで読み込めます。',
    sampleLoaded: (name) => `サンプルを読み込みました: ${name}`,
    orSeparator: 'または',
  },
};
