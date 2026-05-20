import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { GitBranch, Plus, Settings, Sparkles, Table2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FlowChart } from '@/components/graph/FlowChart';
import { IconButton } from '@/components/ui/IconButton';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useQualityChecks } from '@/hooks/useQualityChecks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { ColumnHeader } from './ColumnHeader';
import { OutputColsPanel } from './OutputColsPanel';
import { SortableRow } from './RowHandle';
import { TableHeaderMenu } from './TableHeaderMenu';

interface Props {
  tableId: string;
  onOpenSampleGallery?: () => void;
}

type Tab = 'table' | 'flowchart';

export function DecisionTable({ tableId, onOpenSampleGallery }: Props) {
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [highlightedRowIds, setHighlightedRowIds] = useState<Set<string>>(
    new Set(),
  );
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const logic = useLogicStore((s) => s.logic);
  const addCol = useLogicStore((s) => s.addCol);
  const addRow = useLogicStore((s) => s.addRow);
  const moveRow = useLogicStore((s) => s.moveRow);
  const moveCol = useLogicStore((s) => s.moveCol);
  const renameTable = useLogicStore((s) => s.renameTable);
  const setEntryTable = useLogicStore((s) => s.setEntryTable);
  const highlightTarget = useUiStore((s) => s.highlightTarget);
  const setHighlightTarget = useUiStore((s) => s.setHighlightTarget);
  const t = useT();

  const table = logic.tables[tableId];

  const { contradictory, duplicates, unreachable, coverageGaps } =
    useQualityChecks(
      table ?? { rows: [], cols: [], id: '', name: '', outputCols: [] },
      logic.fieldDefs,
    );
  const gapCount = coverageGaps.length;

  const handleFlowNodeClick = useCallback((rowIds: string[]) => {
    if (rowIds.length === 0) return;
    setHighlightedRowIds(new Set(rowIds));
    setActiveTab('table');
  }, []);

  useEffect(() => {
    if (!highlightTarget || highlightTarget.tableId !== tableId) return;
    setActiveTab('table');
    if (highlightTarget.rowId) {
      setHighlightedRowIds(new Set([highlightTarget.rowId]));
      requestAnimationFrame(() => {
        const el = tableContainerRef.current?.querySelector(
          `[data-row-id="${CSS.escape(highlightTarget.rowId!)}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      tableContainerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
    const clearTimer = window.setTimeout(() => {
      setHighlightedRowIds(new Set());
      setHighlightTarget(null);
    }, 4000);
    return () => window.clearTimeout(clearTimer);
  }, [highlightTarget, tableId, setHighlightTarget]);

  if (!table) return <div className="p-4 text-gray-400">{t.tableNotFound}</div>;

  const rowIds = table.rows.map((r) => r.id);
  const colIds = table.cols.map((c) => c.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const type = active.data.current?.type;
    if (type === 'col') {
      const from = table.cols.findIndex((c) => c.id === active.id);
      const to = table.cols.findIndex((c) => c.id === over.id);
      if (from !== -1 && to !== -1) moveCol(tableId, from, to);
      return;
    }
    const from = table.rows.findIndex((r) => r.id === active.id);
    const to = table.rows.findIndex((r) => r.id === over.id);
    if (from !== -1 && to !== -1) moveRow(tableId, from, to);
  };

  const handleRename = (name: string) => {
    const result = renameTable(tableId, name);
    if (result.error) toast.error(result.error);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'flowchart') {
      setHighlightedRowIds(new Set());
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <InlineEdit
              value={table.name}
              onSave={handleRename}
              className="font-semibold text-sm"
            />
            {logic.entryTableId === tableId && (
              <span className="bg-violet-100 text-violet-700 text-xs px-1.5 py-0.5 rounded">
                {t.entryBadge}
              </span>
            )}
            {logic.entryTableId !== tableId && (
              <button
                type="button"
                onClick={() => setEntryTable(tableId)}
                className="text-xs text-gray-400 hover:text-violet-600"
                title={t.setEntryTitle}
              >
                {t.setEntry}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => handleTabChange('table')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                  activeTab === 'table'
                    ? 'bg-gray-100 text-gray-800'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Table2 size={11} /> {t.tableTab}
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('flowchart')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                  activeTab === 'flowchart'
                    ? 'bg-gray-100 text-gray-800'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <GitBranch size={11} /> {t.flowchartTab}
                {gapCount > 0 && (
                  <span className="bg-yellow-200 text-yellow-800 text-[10px] font-semibold px-1 rounded leading-tight">
                    ⚠️ {gapCount}
                  </span>
                )}
              </button>
            </div>

            <TableHeaderMenu tableId={tableId} />
          </div>
        </div>

        {/* Table view */}
        {activeTab === 'table' && (
          <>
            <div ref={tableContainerRef} className="overflow-x-auto pb-3">
              <table
                className="border-collapse text-sm"
                style={{ tableLayout: 'fixed' }}
              >
                <thead>
                  <tr>
                    <th className="border-b border-r bg-gray-50 w-14 sticky left-0 z-10" />
                    <th className="border-b border-r bg-gray-50 w-10 text-xs text-gray-400 px-2">
                      #
                    </th>
                    <SortableContext
                      items={colIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      {table.cols.map((col) => (
                        <ColumnHeader
                          key={col.id}
                          tableId={tableId}
                          colId={col.id}
                          fieldId={col.fieldId}
                        />
                      ))}
                    </SortableContext>
                    <th
                      className="border-b border-r bg-gray-50 p-0"
                      style={{ width: 32, minWidth: 32, maxWidth: 32 }}
                    >
                      <button
                        type="button"
                        onClick={() => addCol(tableId)}
                        title={t.addConditionCol}
                        aria-label={t.addConditionCol}
                        className="w-full h-full flex items-center justify-center text-gray-400 hover:text-violet-700 hover:bg-violet-50 transition-colors py-1.5"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                      </button>
                    </th>
                    <th
                      className="border-b border-r bg-gray-50 px-2 py-1 text-xs font-medium relative"
                      style={{ minWidth: 240 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{t.conclusion}</span>
                        <IconButton
                          size="xs"
                          onClick={() => setShowOutputPanel(!showOutputPanel)}
                          title={t.manageOutputCols}
                          aria-label={t.manageOutputCols}
                        >
                          <Settings />
                        </IconButton>
                      </div>
                      {showOutputPanel && (
                        <OutputColsPanel
                          tableId={tableId}
                          outputCols={table.outputCols}
                          onClose={() => setShowOutputPanel(false)}
                        />
                      )}
                    </th>
                    <th className="border-b border-l bg-gray-50 w-16 sticky right-0 z-10" />
                  </tr>
                </thead>
                <tbody>
                  <SortableContext
                    items={rowIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.rows.map((row, i) => (
                      <SortableRow
                        key={row.id}
                        tableId={tableId}
                        table={table}
                        row={row}
                        rowIndex={i}
                        totalRows={table.rows.length}
                        duplicateWarning={duplicates.has(row.id)}
                        unreachableWarning={unreachable.has(row.id)}
                        contradictoryInfo={contradictory.get(row.id)}
                        fieldDefs={logic.fieldDefs}
                        highlighted={highlightedRowIds.has(row.id)}
                      />
                    ))}
                  </SortableContext>
                  {table.rows.length > 0 && (
                    <tr>
                      <td
                        colSpan={5 + table.cols.length}
                        className="border-b p-0"
                      >
                        <button
                          type="button"
                          onClick={() => addRow(tableId)}
                          title={t.addRow}
                          aria-label={t.addRow}
                          className="w-full flex items-center justify-center text-gray-300 hover:text-violet-700 hover:bg-violet-50 transition-colors py-1 group/addrow"
                        >
                          <Plus
                            size={14}
                            strokeWidth={2.5}
                            className="group-hover/addrow:scale-110 transition-transform"
                          />
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(table.rows.length === 0 || table.cols.length === 0) && (
              <div className="flex items-center justify-center px-4 py-10 border-t bg-gray-50/50">
                <div className="flex flex-col items-center gap-3 bg-white border border-gray-200 rounded-lg shadow-sm px-8 py-6 max-w-md">
                  {table.rows.length === 0 && table.cols.length === 0 && (
                    <p className="text-sm text-gray-600 mb-1">
                      {t.emptyTableHelper}
                    </p>
                  )}
                  {onOpenSampleGallery &&
                    Object.keys(logic.fieldDefs).length === 0 &&
                    table.rows.length === 0 &&
                    table.cols.length === 0 && (
                      <>
                        <button
                          type="button"
                          onClick={onOpenSampleGallery}
                          className="w-72 flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded px-3 py-2"
                        >
                          <Sparkles size={16} strokeWidth={2.5} />
                          {t.startFromSample}
                        </button>
                        <p className="text-xs text-gray-500 text-center -mt-1 max-w-xs">
                          {t.startFromSampleHint}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400 w-72">
                          <span className="flex-1 border-t border-gray-200" />
                          <span>{t.orSeparator}</span>
                          <span className="flex-1 border-t border-gray-200" />
                        </div>
                      </>
                    )}
                  {table.cols.length === 0 && (
                    <button
                      type="button"
                      onClick={() => addCol(tableId)}
                      className="w-72 flex items-center justify-center gap-1.5 text-sm text-violet-700 hover:text-violet-900 bg-white border border-violet-300 hover:border-violet-500 rounded px-3 py-2"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                      {t.addFirstConditionCol}
                    </button>
                  )}
                  {table.rows.length === 0 && (
                    <button
                      type="button"
                      onClick={() => addRow(tableId)}
                      className="w-72 flex items-center justify-center gap-1.5 text-sm text-violet-700 hover:text-violet-900 bg-white border border-violet-300 hover:border-violet-500 rounded px-3 py-2"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                      {t.addFirstRow}
                    </button>
                  )}
                </div>
              </div>
            )}

            {gapCount > 0 && table.rows.length > 0 && (
              <div className="mx-4 mb-3 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800 flex items-center justify-between gap-2">
                <span>⚠️ {t.coverageGapWarning(gapCount)}</span>
                <button
                  type="button"
                  onClick={() => handleTabChange('flowchart')}
                  className="text-yellow-900 hover:text-yellow-700 font-medium underline whitespace-nowrap"
                >
                  {t.viewInFlowchart} →
                </button>
              </div>
            )}
          </>
        )}

        {/* Flowchart view */}
        {activeTab === 'flowchart' && (
          <FlowChart
            tableId={tableId}
            highlightedRowIds={highlightedRowIds}
            onNodeClick={handleFlowNodeClick}
            coverageGaps={coverageGaps}
          />
        )}
      </div>
    </DndContext>
  );
}
