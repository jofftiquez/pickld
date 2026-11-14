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
}

/** The dark left rail (design: ModConsole): name, sections, and who is signed in. */
export function Sidebar({ items, name }: { items: NavItem[]; name: string }) {
  const path = usePathname();
  const filter = useSearchParams().get('filter');
  const here = filter && filter !== 'all' ? `${path}?filter=${filter}` : path;
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
        minHeight: '100vh',
      }}
    >
      <p
        style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 10px 24px', fontWeight: 800, fontSize: 17 }}
      >
        <Mark />
        {t('site.name')}
      </p>
      <nav aria-label={t('nav.label')} style={{ display: 'grid', gap: 4 }}>
        {items.map((item) => {
          // Reports and Appeals are queue filters, so Queue lights up only for the other filters.
          const active =
            item.href === '/'
              ? path === '/'
              : item.href.includes('?')
                ? here === item.href
                : item.href === '/queue'
                  ? path === '/queue' && !items.some((other) => other.href.includes('?') && other.href === here)
                  : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                padding: '12px 10px',
                borderRadius: radius.thumbLg,
                background: active ? colors.brand : 'transparent',
                color: active ? colors.ink : colors.surface,
                fontWeight: active ? 800 : 600,
                fontSize: 15,
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
        })}
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
