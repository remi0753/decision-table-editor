import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'danger' | 'primary' | 'drag';
type Size = 'xs' | 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
}

const sizeClass: Record<Size, string> = {
  xs: 'w-7 h-7 [&_svg]:w-3.5 [&_svg]:h-3.5',
  sm: 'w-7 h-7 [&_svg]:w-4 [&_svg]:h-4',
  md: 'w-8 h-8 [&_svg]:w-5 [&_svg]:h-5',
};

const toneClass: Record<Tone, string> = {
  neutral:
    'text-fg-subtle hover:bg-surface-subtle hover:text-fg-secondary disabled:hover:bg-transparent',
  danger:
    'text-fg-faint hover:bg-danger-bg hover:text-danger-fg disabled:hover:bg-transparent',
  primary:
    'text-fg-muted hover:bg-brand-subtle hover:text-brand-fg disabled:hover:bg-transparent',
  drag: 'text-fg-faint hover:text-fg-subtle cursor-grab active:cursor-grabbing',
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  function IconButton(
    { tone = 'neutral', size = 'sm', className, type, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(
          'inline-flex items-center justify-center rounded transition-colors disabled:opacity-30',
          sizeClass[size],
          toneClass[tone],
          className,
        )}
        {...props}
      />
    );
  },
);
