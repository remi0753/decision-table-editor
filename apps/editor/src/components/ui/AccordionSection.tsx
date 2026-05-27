import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}

export function AccordionSection({
  title,
  open,
  onToggle,
  actions,
  bodyClassName,
  children,
}: Props) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between gap-1 border-l-2 border-violet-500 bg-violet-50/80 py-1.5 pl-2.5 pr-3 shadow-[inset_0_-1px_0_rgba(124,58,237,0.08)]">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 flex-1 min-w-0 text-left text-xs font-semibold text-violet-800 hover:text-violet-950"
        >
          {open ? (
            <ChevronDown size={12} className="shrink-0" />
          ) : (
            <ChevronRight size={12} className="shrink-0" />
          )}
          <span className="truncate tracking-wide uppercase">{title}</span>
        </button>
        {actions && (
          <div className="flex items-center gap-1 shrink-0">{actions}</div>
        )}
      </div>
      {open && <div className={cn('bg-white', bodyClassName)}>{children}</div>}
    </div>
  );
}
