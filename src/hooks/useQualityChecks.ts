import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  findDuplicateRows,
  findUnreachableRows,
  hasDefaultRow,
} from '@/engine/checks';
import type { Table } from '@/types/logic';

export function useQualityChecks(table: Table) {
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [unreachable, setUnreachable] = useState<Set<string>>(new Set());
  const [noDefault, setNoDefault] = useState(false);

  const runChecks = useDebouncedCallback(() => {
    setDuplicates(findDuplicateRows(table));
    setUnreachable(findUnreachableRows(table));
    setNoDefault(!hasDefaultRow(table));
  }, 300);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runChecks is a stable debounced callback
  useEffect(() => {
    runChecks();
  }, [table.rows, table.cols]);

  return { duplicates, unreachable, noDefault };
}
