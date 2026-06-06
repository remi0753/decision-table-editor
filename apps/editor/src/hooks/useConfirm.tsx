import { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Promise-based replacement for `window.confirm`. Renders the in-app
 * {@link ConfirmDialog} instead of the browser-native modal, so confirmations
 * match the app's styling, theming, and i18n.
 *
 * Usage:
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm();
 * // in a handler:
 * if (!(await confirm({ title, description, destructive: true }))) return;
 * // in JSX:
 * return <>...{confirmDialog}</>;
 * ```
 *
 * The returned promise resolves to `true` when the user confirms and `false`
 * when they cancel or dismiss the dialog (Esc, overlay click, etc.).
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    // Resolve at most once: clicking the action button both fires onConfirm and
    // closes the dialog (onOpenChange(false)), so the second call is a no-op.
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    // If a previous prompt is somehow still pending, treat it as cancelled so
    // its awaiter doesn't hang forever.
    resolverRef.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={options?.title ?? ''}
      description={options?.description ?? ''}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      destructive={options?.destructive}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, confirmDialog };
}
