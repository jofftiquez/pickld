'use client';

import { useFormStatus } from 'react-dom';

/**
 * A form's submit button that turns into a disabled spinner while its server action runs, so a second click
 * (or Enter) can't post the form again and send a second code email. The status line tells screen readers.
 */
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button className="mk-btn" type="submit" disabled={pending} aria-busy={pending || undefined}>
        {pending ? <span className="mk-spinner" aria-hidden /> : null}
        {pending ? pendingLabel : label}
      </button>
      <span className="mk-sr" role="status">
        {pending ? pendingLabel : ''}
      </span>
    </>
  );
}
