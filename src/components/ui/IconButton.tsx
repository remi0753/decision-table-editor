import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'danger' | 'primary' | 'drag';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
}

const sizeClass: Record<Size, string> = {
  sm: 'w-7 h-7 [&_svg]:w-4 [&_svg]:h-4',
  md: 'w-8 h-8 [&_svg]:w-5 [&_svg]:h-5',
};

const toneClass: Record<Tone, string> = {
  neutral:
    'text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:hover:bg-transparent',
  danger:
    'text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:hover:bg-transparent',
  primary:
    'text-gray-600 hover:bg-violet-50 hover:text-violet-700 disabled:hover:bg-transparent',
  drag: 'text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing',
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
