import type { EvalResult } from './logic.js';

export interface BatchCase {
  name: string;
  inputs: Record<string, string>; // fieldId -> value
  expected: Record<string, string>; // outputColId -> expected value
}

export interface BatchCaseResult {
  batchCase: BatchCase;
  result: EvalResult;
  pass: boolean | null; // null = no expected values defined
}
