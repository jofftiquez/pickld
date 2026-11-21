'use client';

import Link from 'next/link';
import { type MouseEvent, useRef } from 'react';

/**
 * The phone header's Menu: a disclosure (works without JavaScript) listing every page. Picking a link closes it,
 * since the header stays mounted when Next.js moves to the next page.
 */
export function MarketingMenu({ label, links }: { label: string; links: { href: string; label: string }[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a') && menu.current) menu.current.open = false;
  };
  return (
    <details className="mk-menu" ref={menu}>
      <summary aria-label={label}>
        <span className="mk-menu-icon" aria-hidden />
        {label}
      </summary>
      <ul onClick={close}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
