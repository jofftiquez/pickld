import Link from 'next/link';

import { cn } from '~/lib/utils';

/**
 * A row of filter links in a segmented track (shadcn/ui Tabs look): queue filters, the Analytics window. The
 * current one is ink, as in the design; `current` is the aria-current value it gets.
 */
export function Segmented({
  label,
  items,
  current = 'page',
}: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
  current?: 'page' | 'true';
}) {
  return (
    <nav aria-label={label} className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-muted p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? current : undefined}
          className={cn(
            "relative inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-bold text-foreground no-underline transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            item.active && 'bg-foreground text-background shadow-sm hover:bg-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
