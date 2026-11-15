import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

/** A form field: its bold label above the control it wraps, and an optional hint below. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('grid min-w-0 gap-1.5 text-[13px] font-bold', className)}>
      {label}
      {children}
      {hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/**
 * What a form did: `ok` is a green status line, `error` an alert, `muted` a quiet status. `role` follows the
 * tone, so screen readers hear errors at once.
 */
export function FormNote({
  tone,
  className,
  children,
}: {
  tone: 'ok' | 'error' | 'muted';
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'm-0 text-[13px]',
        tone === 'ok' && 'font-semibold text-brand-text',
        tone === 'error' && 'text-destructive',
        tone === 'muted' && 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}
