export type FieldType =
  | 'number'
  | 'string'
  | 'bool'
  | 'enum'
  | 'date'
  | 'datetime';

export interface FieldDef {
  id: string;
  name: string;
  type: FieldType;
  enumValues?: string[];
}

export type Operator =
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'between'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'before_today'
  | 'today_or_before'
  | 'after_today'
  | 'today_or_after'
  | 'null';

export interface Cell {
  op: Operator;
  val?: string | string[];
}

export interface TerminalConclusion {
  type: 'terminal';
  outputs: Record<string, string>;
}

export interface ContinueConclusion {
  type: 'continue';
  tableId: string;
}

export type Conclusion = TerminalConclusion | ContinueConclusion;

export interface Col {
  id: string;
  fieldId: string | null;
}

export interface OutputCol {
  id: string;
  name: string;
}

export interface Row {
  id: string;
  cells: Record<string, Cell>;
  conclusion: Conclusion;
}

export interface Table {
  id: string;
  name: string;
  cols: Col[];
  outputCols: OutputCol[];
  rows: Row[];
}

export interface Logic {
  version: '2';
  name: string;
  description?: string;
  entryTableId: string;
  fieldDefs: Record<string, FieldDef>;
  tables: Record<string, Table>;
  nField: number;
  nTable: number;
  nCol: number;
  nOCol: number;
  nRow: number;
}

export interface SkippedRow {
  rowId: string;
  failedColId: string;
}

export interface TraceStep {
  tableId: string;
  tableName: string;
  depth: number;
  matchedRowId: string | null;
  skippedRows: SkippedRow[];
}

export interface EvalResultOk {
  status: 'ok';
  outputs: Record<string, string>;
  trace: TraceStep[];
}

export interface EvalResultNoMatch {
  status: 'no_match';
  tableId: string;
  trace: TraceStep[];
}

export type EvalResult = EvalResultOk | EvalResultNoMatch;

export type WarningType = 'duplicate' | 'unreachable' | 'no_default';

export interface RowWarning {
  rowId: string;
  type: WarningType;
}

export interface QualityCheckResult {
  warnings: RowWarning[];
  hasNoDefault: boolean;
}
