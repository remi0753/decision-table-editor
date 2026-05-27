import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { useState } from 'react';
import { DagGraph } from '@/components/graph/DagGraph';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';

export function LogicInsightBar() {
  const [open, setOpen] = useState(false);
  const logic = useLogicStore((s) => s.logic);
  const t = useT();
  const tableCount = Object.keys(logic.tables).length;
  const linkCount = Object.values(logic.tables).reduce((count, table) => {
    return (
      count +
      table.rows.filter((row) => row.conclusion.type === 'continue').length
    );
  }, 0);

  return (
    <section className="mb-2 overflow-hidden rounded border border-violet-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center justify-between gap-3 bg-violet-50/45 px-3 py-1.5 text-left outline-none hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-violet-200 bg-white text-violet-700">
            <GitBranch size={15} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-violet-900">
              {t.logicOverview}
            </div>
            <div className="truncate text-[11px] text-gray-500">
              {t.logicOverviewSummary(tableCount, linkCount)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InsightPill label={t.logicOverviewTables} value={tableCount} />
          <InsightPill label={t.logicOverviewLinks} value={linkCount} />
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded text-gray-500',
              open ? 'bg-white text-violet-700 shadow-sm' : '',
            )}
            title={open ? t.hideLogicOverview : t.showLogicOverview}
          >
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </div>
      </button>
      {open ? (
        <div className="border-t border-violet-100 bg-white p-2">
          <div className="h-56 overflow-hidden rounded border border-gray-200 bg-white">
            <DagGraph height={224} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InsightPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="hidden h-7 items-center gap-1 rounded border border-violet-100 bg-white px-2 text-[11px] text-gray-500 shadow-sm sm:flex">
      <span>{label}</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </span>
  );
}
