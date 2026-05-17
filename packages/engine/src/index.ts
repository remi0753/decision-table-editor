// Runtime

export { runBatchEvaluation } from './batch';
export type { CoercedValue } from './coerce';
export { cmp, coerce, today } from './coerce';
export { evaluateTable } from './evaluate';
export { FieldDefsFileSchema, LogicSchema } from './io';
// Types — Batch
export type { BatchCase, BatchCaseResult } from './types/batch';
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
} from './types/logic';
