import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ContradictoryInfo } from '@leverie/checks';
import type { FieldDef, Row, Table } from '@leverie/engine';
import {
  AlertTriangle,
  Copy,
  GripVertical,
  OctagonAlert,
  Plus,
  Trash2,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { CellEditor } from './CellEditor';
import { ConclusionCell } from './ConclusionCell';

function focusFirstCellOfRow(rowId: string) {
  requestAnimationFrame(() => {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    const trigger = row?.querySelector<HTMLElement>('[data-cell-trigger]');
    trigger?.focus();
  });
}

type Severity = 'error' | 'warning' | null;

function pickSeverity(
  contradictory: boolean,
  unreachable: boolean,
  duplicate: boolean,
): Severity {
  if (contradictory || unreachable) return 'error';
  if (duplicate) return 'warning';
  return null;
}

interface Props {
  tableId: string;
  table: Table;
  row: Row;
  rowIndex: number;
  totalRows: number;
  duplicateWarning: boolean;
  unreachableWarning: boolean;
  contradictoryInfo?: ContradictoryInfo;
  fieldDefs: Record<string, FieldDef>;
  highlighted?: boolean;
}

export function SortableRow({
  tableId,
  table,
  row,
  rowIndex,
  totalRows,
  duplicateWarning,
  unreachableWarning,
  contradictoryInfo,
  fieldDefs,
  highlighted,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, data: { type: 'row' } });
  const setCell = useLogicStore((s) => s.setCell);
  const clearCell = useLogicStore((s) => s.clearCell);
  const deleteRow = useLogicStore((s) => s.deleteRow);
  const duplicateRow = useLogicStore((s) => s.duplicateRow);
  const addRow = useLogicStore((s) => s.addRow);
  const insertRowAfter = useLogicStore((s) => s.insertRowAfter);
  const t = useT();

  const isLastRow = rowIndex === totalRows - 1;
  const isContradictory = contradictoryInfo != null;
  const severity = pickSeverity(
    isContradictory,
    unreachableWarning,
    duplicateWarning,
  );

  const handleInsertBelow = () => {
    const newId = insertRowAfter(tableId, row.id);
    if (newId) focusFirstCellOfRow(newId);
  };

  const handleAdvanceFromLastRow = () => {
    const newId = addRow(tableId);
    if (newId) focusFirstCellOfRow(newId);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const bandColor =
    severity === 'error'
      ? 'bg-danger'
      : severity === 'warning'
        ? 'bg-warning'
        : null;

  const stickyBg = cn(
    'bg-surface group-hover:bg-surface-muted',
    isDragging && 'bg-brand-subtle',
    highlighted && 'bg-warning-bg',
  );

  return (
    <tr
      ref={setNodeRef}
      data-row-id={row.id}
      style={style}
      className={cn(
        'group hover:bg-surface-muted',
        isDragging && 'bg-brand-subtle',
        highlighted && 'bg-warning-bg',
      )}
    >
      <td
        className={cn(
          'border-b border-r py-0.5 w-14 relative sticky left-0 z-10 group-hover:z-30',
          stickyBg,
        )}
      >
        {bandColor && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-0 top-0 bottom-0 w-1 z-20',
              bandColor,
            )}
          />
        )}
        <div className="flex flex-row items-center justify-center gap-1 pl-1">
          <div className="w-5 h-7 flex items-center justify-center">
            {severity && (
              <RowWarningIndicator
                severity={severity}
                unreachable={unreachableWarning}
                duplicate={duplicateWarning}
                contradictoryInfo={contradictoryInfo}
                fieldDefs={fieldDefs}
                table={table}
              />
            )}
          </div>
          <IconButton {...attributes} {...listeners} tone="drag" size="xs">
            <GripVertical />
          </IconButton>
        </div>
        {!isLastRow && (
          <button
            type="button"
            onClick={handleInsertBelow}
            title={t.insertRowBelow}
            aria-label={t.insertRowBelow}
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-surface border border-brand-border-strong text-brand-fg rounded-full hover:bg-brand-subtle flex items-center justify-center w-4 h-4"
          >
            <Plus size={10} strokeWidth={2.5} />
          </button>
        )}
      </td>
      <td className="border-b border-r px-2 py-0.5 text-xs text-fg-faint text-center w-10">
        {rowIndex + 1}
      </td>
      {table.cols.map((col) => {
        const field = col.fieldId ? (fieldDefs[col.fieldId] ?? null) : null;
        const cellContradicts = contradictoryInfo?.colIds.has(col.id) ?? false;
        return (
          <td
            key={col.id}
            className={cn(
              'border-b border-r p-0 h-8',
              cellContradicts && 'ring-1 ring-inset ring-danger bg-danger-bg',
            )}
            style={{ width: 160 }}
          >
            <CellEditor
              cell={row.cells[col.id]}
              field={field}
              onSave={(cell) => setCell(tableId, row.id, col.id, cell)}
              onClear={() => clearCell(tableId, row.id, col.id)}
            />
          </td>
        );
      })}
      <td
        className="border-b border-r"
        style={{ width: 32, minWidth: 32, maxWidth: 32 }}
      />
      <td className="border-b border-r p-0 h-8" style={{ minWidth: 240 }}>
        <ConclusionCell
          tableId={tableId}
          rowId={row.id}
          conclusion={row.conclusion}
          outputCols={table.outputCols}
          isLastRow={isLastRow}
          onAdvance={handleAdvanceFromLastRow}
        />
      </td>
      <td
        className={cn(
          'border-b border-l px-1 py-0.5 w-16 text-center sticky right-0 z-10',
          stickyBg,
        )}
      >
        <div className="flex flex-row items-center justify-center opacity-0 group-hover:opacity-100 gap-0.5">
          <IconButton
            tone="primary"
            size="xs"
            onClick={() => duplicateRow(tableId, row.id)}
            title={t.duplicateRow}
            aria-label={t.duplicateRow}
          >
            <Copy />
          </IconButton>
          <IconButton
            tone="danger"
            size="xs"
            onClick={() => deleteRow(tableId, row.id)}
            title={t.deleteRow}
            aria-label={t.deleteRow}
          >
            <Trash2 />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

interface RowWarningIndicatorProps {
  severity: Exclude<Severity, null>;
  unreachable: boolean;
  duplicate: boolean;
  contradictoryInfo?: ContradictoryInfo;
  fieldDefs: Record<string, FieldDef>;
  table: Table;
}

function RowWarningIndicator({
  severity,
  unreachable,
  duplicate,
  contradictoryInfo,
  fieldDefs,
  table,
}: RowWarningIndicatorProps) {
  const t = useT();
  const Icon = severity === 'error' ? OctagonAlert : AlertTriangle;
  const colorClass =
    severity === 'error' ? 'text-danger-fg' : 'text-warning-fg';
  const label = severity === 'error' ? t.rowErrorLabel : t.rowWarningLabel;

  return (
    <Tooltip
      content={
        <div className="max-w-xs space-y-1 leading-snug">
          {contradictoryInfo && (
            <div>
              <div className="font-medium">{t.contradictoryRowTooltip}</div>
              {contradictoryInfo.pairs.map((pair) => {
                const field = fieldDefs[pair.fieldId];
                const fieldName = field?.name ?? pair.fieldId;
                const colIndexA =
                  table.cols.findIndex((c) => c.id === pair.colIdA) + 1;
                const colIndexB =
                  table.cols.findIndex((c) => c.id === pair.colIdB) + 1;
                return (
                  <div
                    key={`${pair.fieldId}:${pair.colIdA}:${pair.colIdB}`}
                    className="text-danger-fg mt-0.5"
                  >
                    {t.contradictoryRowCellHint(
                      fieldName,
                      `#${colIndexA}`,
                      `#${colIndexB}`,
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {unreachable && <div>{t.unreachableRowTooltip}</div>}
          {duplicate && <div>{t.duplicateRowTooltip}</div>}
        </div>
      }
      side="right"
    >
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded',
          colorClass,
        )}
      >
        <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
