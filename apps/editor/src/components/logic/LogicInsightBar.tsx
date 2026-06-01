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
    <section className="mb-2 overflow-hidden rounded border border-brand-border-subtle bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center justify-between gap-3 bg-brand-subtle/45 px-3 py-1.5 text-left outline-none hover:bg-brand-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-brand-border bg-surface text-brand-fg">
            <GitBranch size={15} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-brand-fg-strong">
              {t.logicOverview}
            </div>
            <div className="truncate text-[11px] text-fg-subtle">
              {t.logicOverviewSummary(tableCount, linkCount)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InsightPill label={t.logicOverviewTables} value={tableCount} />
          <InsightPill label={t.logicOverviewLinks} value={linkCount} />
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded text-fg-subtle',
              open ? 'bg-surface text-brand-fg shadow-sm' : '',
            )}
            title={open ? t.hideLogicOverview : t.showLogicOverview}
          >
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </div>
      </button>
      {open ? (
        <div className="border-t border-brand-border-subtle bg-surface p-2">
          <div className="h-56 overflow-hidden rounded border border-line bg-surface">
            <DagGraph height={224} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InsightPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="hidden h-7 items-center gap-1 rounded border border-brand-border-subtle bg-surface px-2 text-[11px] text-fg-subtle shadow-sm sm:flex">
      <span>{label}</span>
      <span className="font-semibold text-fg-secondary">{value}</span>
    </span>
  );
}
