import type { ReactNode } from 'react';

/** A titled group of Tiles (Overview, Waitlist, Analytics), with an optional link or control on the right. */
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 10 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
        {action}
      </header>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
          margin: 0,
        }}
      >
        {children}
      </dl>
    </section>
  );
}
