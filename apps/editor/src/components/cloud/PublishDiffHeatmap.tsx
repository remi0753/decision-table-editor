import { ArrowUpDown, Minus, Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import type { CellStatus, GridRow, TableGrid } from '@/lib/logicDiffSummary';

type Props = {
  grids: TableGrid[];
  onSelectRule: (ruleId: string) => void;
};

const CELL_TONE: Record<CellStatus, string> = {
  unchanged: 'bg-surface-subtle',
  changed: 'bg-warning',
  added: 'bg-success',
  removed: 'bg-danger',
};

const ROW_ACCENT: Record<GridRow['kind'], string> = {
  unchanged: 'border-transparent',
  changed: 'border-warning-border',
  added: 'border-success-border',
  removed: 'border-danger-border',
};

function RowGlyph({ kind }: { kind: GridRow['kind'] }) {
  if (kind === 'added')
    return <Plus className="h-3 w-3 text-success-fg" aria-hidden />;
  if (kind === 'removed')
    return <Minus className="h-3 w-3 text-danger-fg" aria-hidden />;
  return null;
}

function LegendItem({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
      <span className={`h-3 w-3 rounded-sm ${tone}`} />
      {label}
    </span>
  );
}

function GridRowView({
  row,
  conditionCount,
  outputCount,
  onSelectRule,
}: {
  row: GridRow;
  conditionCount: number;
  outputCount: number;
  onSelectRule: (ruleId: string) => void;
}) {
  const conditionCells = row.cells.slice(0, conditionCount);
  const outputCells = row.cells.slice(
    conditionCount,
    conditionCount + outputCount,
  );
  const rowNumber = row.afterRowNumber ?? row.beforeRowNumber;
  const clickable = row.kind !== 'unchanged' && row.hasRuleDiff;

  const content = (
    <>
      <span
        className={`flex w-12 shrink-0 items-center gap-1 border-l-2 pl-2 text-[11px] tabular-nums ${ROW_ACCENT[row.kind]} ${
          row.kind === 'removed'
            ? 'text-fg-faint line-through'
            : 'text-fg-subtle'
        }`}
      >
        <RowGlyph kind={row.kind} />#{rowNumber}
        {row.reordered ? (
          <ArrowUpDown className="h-3 w-3 text-warning-fg" aria-hidden />
        ) : null}
      </span>
      <span className="flex gap-1">
        {conditionCells.map((cell) => (
          <span
            key={cell.colId}
            className={`h-5 w-5 rounded-sm ${CELL_TONE[cell.status]}`}
          />
        ))}
      </span>
      {outputCells.length > 0 ? (
        <span className="ml-2 flex gap-1 border-l border-line pl-2">
          {outputCells.map((cell) => (
            <span
              key={cell.colId}
              className={`h-5 w-5 rounded-sm ${CELL_TONE[cell.status]}`}
            />
          ))}
        </span>
      ) : null}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onSelectRule(row.ruleId)}
        className="flex w-full items-center rounded py-0.5 text-left hover:bg-brand-subtle"
      >
        {content}
      </button>
    );
  }

  return <div className="flex items-center py-0.5">{content}</div>;
}

function TableGridView({
  grid,
  onSelectRule,
}: {
  grid: TableGrid;
  onSelectRule: (ruleId: string) => void;
}) {
  const t = useT();
  const conditionCount = grid.columns.filter(
    (col) => col.kind === 'condition',
  ).length;
  const outputCount = grid.columns.length - conditionCount;
  // Each cell is 20px (w-5) wide with a 4px (gap-1) gutter between cells.
  const groupWidth = (count: number) =>
    count > 0 ? count * 20 + (count - 1) * 4 : 0;

  if (!grid.hasChanges) {
    return (
      <div className="flex items-center justify-between gap-2 rounded border border-line bg-surface px-3 py-2">
        <span className="truncate text-xs font-medium text-fg-subtle">
          {grid.tableName}
        </span>
        <span className="shrink-0 text-[11px] text-fg-faint">
          {t.publishReviewMapTableUnchanged}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-3 py-2">
        <span className="truncate text-xs font-semibold text-fg-secondary">
          {grid.tableName}
        </span>
        <span className="shrink-0 rounded bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-fg">
          {t.publishReviewMapChangedRows(grid.changedRows)}
        </span>
      </div>
      <div className="overflow-x-auto p-3">
        <div className="min-w-max">
          <div className="mb-1 flex items-center text-[10px] font-medium uppercase tracking-wide text-fg-faint">
            <span className="w-12 shrink-0" />
            <span
              className="shrink-0"
              style={{ width: groupWidth(conditionCount) }}
            >
              {t.publishReviewMapConditions}
            </span>
            {outputCount > 0 ? (
              <span className="ml-2 shrink-0 pl-2">
                {t.publishReviewMapResults}
              </span>
            ) : null}
          </div>
          <div className="space-y-0.5">
            {grid.rows.map((row) => (
              <GridRowView
                key={row.rowId}
                row={row}
                conditionCount={conditionCount}
                outputCount={outputCount}
                onSelectRule={onSelectRule}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublishDiffHeatmap({ grids, onSelectRule }: Props) {
  const t = useT();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendItem
          tone={CELL_TONE.unchanged}
          label={t.publishReviewMapUnchanged}
        />
        <LegendItem tone={CELL_TONE.changed} label={t.publishReviewChanged} />
        <LegendItem tone={CELL_TONE.added} label={t.publishReviewAdded} />
        <LegendItem tone={CELL_TONE.removed} label={t.publishReviewRemoved} />
        <span className="text-[11px] text-fg-faint">
          {t.publishReviewMapHint}
        </span>
      </div>
      <div className="space-y-2">
        {grids.map((grid) => (
          <TableGridView
            key={grid.tableId}
            grid={grid}
            onSelectRule={onSelectRule}
          />
        ))}
      </div>
    </div>
  );
}
