import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  type CoverageGap,
  findCoverageGaps,
  findDuplicateRows,
  findUnreachableRows,
} from '@/engine/checks';
import type { Logic, Table } from '@/types/logic';

export function useQualityChecks(table: Table, fieldDefs: Logic['fieldDefs']) {
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [unreachable, setUnreachable] = useState<Set<string>>(new Set());
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);

  const runChecks = useDebouncedCallback(() => {
    setDuplicates(findDuplicateRows(table));
    setUnreachable(findUnreachableRows(table));
    setCoverageGaps(findCoverageGaps(table, fieldDefs));
  }, 300);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runChecks is a stable debounced callback
  useEffect(() => {
    runChecks();
  }, [table.rows, table.cols]);

  return { duplicates, unreachable, coverageGaps };
}
