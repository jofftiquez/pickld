import type { ReactNode } from 'react';

/** A titled group of Tiles (Overview, Waitlist, Analytics), with an optional link or control on the right. */
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-2.5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-extrabold">{title}</h2>
        {action}
      </header>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">{children}</dl>
    </section>
  );
}
