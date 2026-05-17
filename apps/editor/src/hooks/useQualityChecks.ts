import {
  type ContradictoryInfo,
  type CoverageGap,
  findContradictoryRows,
  findCoverageGaps,
  findDuplicateRows,
  findUnreachableRows,
} from '@leverie/checks';
import type { Logic, Table } from '@leverie/engine';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export function useQualityChecks(table: Table, fieldDefs: Logic['fieldDefs']) {
  const [contradictory, setContradictory] = useState<
    Map<string, ContradictoryInfo>
  >(new Map());
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [unreachable, setUnreachable] = useState<Set<string>>(new Set());
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);

  const runChecks = useDebouncedCallback(() => {
    // Contradictory rows are detected first and short-circuited out of the
    // other checks to avoid misleading duplicate/unreachable warnings that are
    // merely side effects of an intra-row contradiction.
    const contradictoryMap = findContradictoryRows(table, fieldDefs);
    setContradictory(contradictoryMap);

    const contradictoryIds = new Set(contradictoryMap.keys());
    const filteredTable =
      contradictoryIds.size === 0
        ? table
        : {
            ...table,
            rows: table.rows.filter((r) => !contradictoryIds.has(r.id)),
          };

    setDuplicates(findDuplicateRows(filteredTable));
    setUnreachable(findUnreachableRows(filteredTable));
    setCoverageGaps(findCoverageGaps(filteredTable, fieldDefs));
  }, 300);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runChecks is a stable debounced callback
  useEffect(() => {
    runChecks();
  }, [table.rows, table.cols]);

  return { contradictory, duplicates, unreachable, coverageGaps };
}
