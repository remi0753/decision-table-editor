import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';

// Header control that cycles the color theme (system → light → dark). Shared by
// the editor shell and the standalone auth/settings pages so every header
// offers the same switch.
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, cycle } = useTheme();
  const t = useT();
  const { Icon, label } = {
    system: { Icon: Monitor, label: t.themeSystemLabel },
    light: { Icon: Sun, label: t.themeLightLabel },
    dark: { Icon: Moon, label: t.themeDarkLabel },
  }[preference];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={cn(
        'flex items-center rounded border border-line bg-surface px-2 py-1.5 text-fg-subtle cursor-pointer hover:bg-brand-subtle hover:border-brand-border hover:text-brand-fg focus:outline-none focus:ring-1 focus:ring-brand-ring',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
