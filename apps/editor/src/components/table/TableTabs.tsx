import { ChevronLeft, ChevronRight, LogIn, Plus, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

interface Props {
  activeTableId: string | null;
}

export function TableTabs({ activeTableId }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const logic = useLogicStore((s) => s.logic);
  const addTable = useLogicStore((s) => s.addTable);
  const deleteTable = useLogicStore((s) => s.deleteTable);
  const renameTable = useLogicStore((s) => s.renameTable);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const t = useT();

  const tables = Object.values(logic.tables);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !activeTableId) return;
    const el = scroller.querySelector(
      `[data-tab-id="${CSS.escape(activeTableId)}"]`,
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [activeTableId]);

  useLayoutEffect(() => {
    if (renameTargetId) renameInputRef.current?.select();
  }, [renameTargetId]);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-evaluate scroll bounds whenever the tab count changes
  useEffect(() => {
    updateScrollState();
  }, [tables.length, updateScrollState]);

  const handleScrollClick = (direction: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.max(120, el.clientWidth * 0.8);
    el.scrollBy({
      left: direction === 'left' ? -delta : delta,
      behavior: 'smooth',
    });
  };

  const handleAdd = () => {
    const id = addTable();
    setSelectedTable(id);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const wasActive = activeTableId === deleteTarget.id;
    const result = deleteTable(deleteTarget.id);
    if (result.error) {
      toast.error(result.error);
      setDeleteTarget(null);
      return;
    }
    if (wasActive) {
      const [firstId] = Object.keys(useLogicStore.getState().logic.tables);
      if (firstId) setSelectedTable(firstId);
    }
    setDeleteTarget(null);
  };

  const startRename = (id: string, currentName: string) => {
    setRenameTargetId(id);
    setRenameDraft(currentName);
  };

  const commitRename = () => {
    if (!renameTargetId) return;
    const trimmed = renameDraft.trim();
    const current = logic.tables[renameTargetId];
    if (current && trimmed && trimmed !== current.name) {
      const result = renameTable(renameTargetId, trimmed);
      if (result.error) toast.error(result.error);
    }
    setRenameTargetId(null);
  };

  return (
    <div className="flex-1 min-w-0 flex items-end self-stretch pl-3 pt-1">
      <div className="relative min-w-0 self-stretch flex items-end">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScrollClick('left')}
            title={t.scrollTabsLeft}
            aria-label={t.scrollTabsLeft}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center w-6 h-6 rounded bg-white/95 border border-gray-200 shadow-sm text-gray-600 transition-colors hover:text-violet-700 hover:bg-violet-50"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScrollClick('right')}
            title={t.scrollTabsRight}
            aria-label={t.scrollTabsRight}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center w-6 h-6 rounded bg-white/95 border border-gray-200 shadow-sm text-gray-600 transition-colors hover:text-violet-700 hover:bg-violet-50"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        )}
        <div
          ref={scrollerRef}
          className="flex-1 min-w-0 self-stretch flex items-end overflow-x-hidden gap-1.5"
        >
        {tables.map((table) => {
          const isActive = table.id === activeTableId;
          const isEntry = logic.entryTableId === table.id;
          const isRenaming = renameTargetId === table.id;
          return (
            <div
              key={table.id}
              data-tab-id={table.id}
              onClick={() => !isRenaming && setSelectedTable(table.id)}
              onDoubleClick={() =>
                isActive && startRename(table.id, table.name)
              }
              onKeyDown={(e) =>
                !isRenaming && e.key === 'Enter' && setSelectedTable(table.id)
              }
              role="tab"
              aria-selected={isActive}
              tabIndex={isRenaming ? -1 : 0}
              className={cn(
                'group relative flex items-center gap-1.5 pl-4 pr-2 text-xs cursor-pointer shrink-0 max-w-[220px] select-none border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-300',
                isActive
                  ? 'h-[39px] -mb-px pb-[7px] rounded-t-md border-0 border-b-[3px] border-b-violet-600 text-violet-700 font-semibold z-10'
                  : 'h-8 mb-1.5 rounded-md border-transparent bg-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-800',
              )}
            >
              {isEntry && (
                <LogIn
                  size={12}
                  strokeWidth={2.5}
                  className={cn(
                    'shrink-0',
                    isActive ? 'text-violet-600' : 'text-violet-500',
                  )}
                  aria-label={t.entryTableIcon}
                />
              )}
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenameTargetId(null);
                  }}
                  className="min-w-0 w-[132px] bg-white border border-violet-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              ) : (
                <span className="truncate min-w-0">{table.name}</span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget({ id: table.id, name: table.name });
                }}
                title={t.deleteTable}
                aria-label={t.deleteTable}
                className={cn(
                  'shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-gray-400 transition-colors hover:text-red-600 hover:bg-red-50',
                  isActive
                    ? 'opacity-100 text-violet-400'
                    : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        title={t.addTable}
        aria-label={t.addTable}
        className="shrink-0 ml-1 mb-2 inline-flex items-center justify-center w-7 h-7 rounded text-gray-400 transition-colors hover:text-violet-700 hover:bg-violet-50"
      >
        <Plus size={12} strokeWidth={2.5} />
      </button>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.deleteTable}
        description={
          deleteTarget ? t.deleteTableConfirm(deleteTarget.name) : ''
        }
        confirmLabel={t.confirmDefault}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
