'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { colors, radius } from '@/theme/tokens';

import { Mark } from './Mark';
import { t } from '~/i18n/t';

export interface NavItem {
  href: string;
  label: string;
  count?: number;
  /** Pages nested under this item; the item itself is then a heading, not a link. */
  children?: NavItem[];
}

/** The dark left rail (design: ModConsole): name, sections, and who is signed in. It stays put while pages scroll. */
export function Sidebar({ items, name }: { items: NavItem[]; name: string }) {
  const path = usePathname();
  const params = useSearchParams();
  const filter = params.get('filter');
  const here = filter && filter !== 'all' ? `${path}?filter=${filter}` : path;
  // Analytics' window (?days=) carries over between its Charts and Tables pages.
  const days = path.startsWith('/analytics') ? params.get('days') : null;
  // Reports and Appeals are queue filters, so Queue lights up only for the other filters.
  const isActive = (item: NavItem) =>
    item.href === '/'
      ? path === '/'
      : item.href.includes('?')
        ? here === item.href
        : item.href === '/queue'
          ? path === '/queue' && !items.some((other) => other.href.includes('?') && other.href === here)
          : path.startsWith(item.href);
  return (
    <aside
      style={{
        background: colors.ink,
        color: colors.surface,
        width: 234,
        flexShrink: 0,
        padding: '24px 14px 20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        // Fixed while the page scrolls; scrolls on its own only when the window is shorter than the nav.
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <p
        style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 10px 24px', fontWeight: 800, fontSize: 17 }}
      >
        <Mark />
        {t('site.name')}
      </p>
      <nav aria-label={t('nav.label')} style={{ display: 'grid', gap: 4 }}>
        {items.map((item) =>
          item.children ? (
            <div key={item.href} role="group" aria-labelledby={`nav-${item.href}`} style={{ display: 'grid', gap: 2 }}>
              <span
                id={`nav-${item.href}`}
                style={{ padding: '12px 10px 6px', fontWeight: 600, fontSize: 15, color: colors.surface }}
              >
                {item.label}
              </span>
              {item.children.map((child) => (
                <NavLink
                  key={child.href}
                  item={child}
                  href={days ? `${child.href}?days=${days}` : child.href}
                  active={path.startsWith(child.href)}
                  nested
                />
              ))}
            </div>
          ) : (
            <NavLink key={item.href} item={item} href={item.href} active={isActive(item)} />
          ),
        )}
      </nav>
      <div style={{ marginTop: 'auto', padding: '0 8px' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>{t('nav.role', { name })}</p>
        <form action="/sign-out" method="post">
          <button
            type="submit"
            style={{ background: 'none', border: 'none', padding: 0, color: colors.onDarkMuted, fontSize: 13 }}
          >
            {t('nav.signOut')}
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavLink({ item, href, active, nested }: { item: NavItem; href: string; active: boolean; nested?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      style={{
        padding: nested ? '10px 10px 10px 24px' : '12px 10px',
        minHeight: 44,
        boxSizing: 'border-box',
        borderRadius: radius.thumbLg,
        background: active ? colors.brand : 'transparent',
        color: active ? colors.ink : nested ? colors.onDarkMuted : colors.surface,
        fontWeight: active ? 800 : 600,
        fontSize: nested ? 14 : 15,
        textDecoration: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {item.label}
      {item.count !== undefined ? (
        <span
          aria-label={t('nav.count', { count: item.count })}
          style={{
            minWidth: 22,
            padding: '2px 7px',
            borderRadius: radius.pill,
            background: active ? colors.ink : colors.onDarkControl,
            color: colors.surface,
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}
