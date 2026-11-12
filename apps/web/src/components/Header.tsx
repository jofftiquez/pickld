import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';

import { Logo } from './Logo';

/** White top bar with the wordmark and Get the app (design: WebShare). */
export function Header({ getAppUrl }: { getAppUrl: string }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 18px',
        background: colors.surface,
        borderBottom: `1px solid ${colors.divider}`,
      }}
    >
      <Link href="/" style={{ display: 'flex' }}>
        <Logo />
      </Link>
      <a
        href={getAppUrl}
        style={{
          height: 36,
          padding: '0 14px',
          borderRadius: radius.pill,
          background: colors.brand,
          color: colors.surface,
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none',
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        {t('site.getApp')}
      </a>
    </header>
  );
}
