import { useState, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { type Table } from '@/types/logic';
import { findDuplicateRows, findUnreachableRows, hasDefaultRow } from '@/engine/checks';

export function useQualityChecks(table: Table) {
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [unreachable, setUnreachable] = useState<Set<string>>(new Set());
  const [noDefault, setNoDefault] = useState(false);

  const runChecks = useDebouncedCallback(() => {
    setDuplicates(findDuplicateRows(table));
    setUnreachable(findUnreachableRows(table));
    setNoDefault(!hasDefaultRow(table));
  }, 300);

  useEffect(() => {
    runChecks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.rows, table.cols]);

  return { duplicates, unreachable, noDefault };
}
