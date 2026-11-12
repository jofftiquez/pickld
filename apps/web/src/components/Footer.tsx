import Link from 'next/link';

import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';

/** Legal links (FR-PRV-04). */
export function Footer() {
  const link = { color: colors.muted } as const;
  return (
    <footer
      aria-label={t('legal.footer')}
      style={{ display: 'flex', gap: 14, justifyContent: 'center', padding: '8px 18px 24px', fontSize: 12 }}
    >
      <Link href="/terms" style={link}>
        {t('legal.terms')}
      </Link>
      <Link href="/privacy" style={link}>
        {t('legal.privacy')}
      </Link>
      <Link href="/guidelines" style={link}>
        {t('legal.guidelines')}
      </Link>
    </footer>
  );
}
