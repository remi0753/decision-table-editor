// Runtime

export { runBatchEvaluation } from './batch.js';
export type { CoercedValue } from './coerce.js';
export { cmp, coerce, today } from './coerce.js';
export { evaluateTable } from './evaluate.js';
export { FieldDefsFileSchema, LogicSchema } from './io.js';
// Types — Batch
export type { BatchCase, BatchCaseResult } from './types/batch.js';
// Types — Logic
export type {
  Cell,
  Col,
  Conclusion,
  ContinueConclusion,
  EvalResult,
  EvalResultNoMatch,
  EvalResultOk,
  FieldDef,
  FieldType,
  Logic,
  Operator,
  OutputCol,
  QualityCheckResult,
  Row,
  RowWarning,
  SkippedRow,
  Table,
  TerminalConclusion,
  TraceStep,
  WarningType,
} from './types/logic.js';
export type {
  LogicValidationError,
  LogicValidationResult,
} from './validate.js';
export { validateLogicForSave } from './validate.js';
