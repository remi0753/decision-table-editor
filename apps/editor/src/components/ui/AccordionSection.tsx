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
      <div className="flex items-center justify-between gap-1 pl-3 pr-3 py-1.5 bg-gray-100/60">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 flex-1 min-w-0 text-left text-xs font-semibold text-gray-600 hover:text-gray-800"
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
