'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { colors, radius } from '@/theme/tokens';

import { Mark } from './Mark';
import { t } from '~/i18n/t';

export interface NavItem {
  href: string;
  label: string;
}

/** The dark left rail (design: ModConsole): name, sections, and who is signed in. */
export function Sidebar({ items, name }: { items: NavItem[]; name: string }) {
  const path = usePathname();
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
          const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
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
              }}
            >
              {item.label}
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
