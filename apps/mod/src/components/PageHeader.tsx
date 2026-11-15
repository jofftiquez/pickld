import type { ReactNode } from 'react';

/** A page's title and one-line description, with stat tiles or actions on the right (design: ModConsole). */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">{title}</h1>
        {subtitle ? <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div> : null}
      </div>
      {children}
    </header>
  );
}
