import { type Logic } from '@/types/logic';
import { type BatchCase, type BatchCaseResult } from '@/types/batch';
import { evaluateTable } from './evaluate';

function computePass(
  expected: Record<string, string>,
  result: BatchCaseResult['result'],
): boolean | null {
  if (Object.keys(expected).length === 0) return null;
  if (result.status === 'no_match') return false;
  for (const [colId, expectedVal] of Object.entries(expected)) {
    const actualVal = result.outputs[colId] ?? '';
    if (actualVal.trim() !== expectedVal.trim()) return false;
  }
  return true;
}

export function runBatchEvaluation(cases: BatchCase[], logic: Logic): BatchCaseResult[] {
  return cases.map(batchCase => {
    const result = evaluateTable(logic.entryTableId, batchCase.inputs, logic);
    return { batchCase, result, pass: computePass(batchCase.expected, result) };
  });
}
