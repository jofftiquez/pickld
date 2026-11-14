import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { globalCss } from '~/lib/css';

const jakarta = localFont({
  src: [
    { path: '../fonts/PlusJakartaSans_500Medium.ttf', weight: '500' },
    { path: '../fonts/PlusJakartaSans_700Bold.ttf', weight: '700' },
    { path: '../fonts/PlusJakartaSans_800ExtraBold.ttf', weight: '800' },
  ],
  display: 'swap',
});

export const metadata: Metadata = {
  title: t('site.name'),
  description: t('site.description'),
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={jakarta.className}
        style={{ margin: 0, background: colors.background, color: colors.ink, fontWeight: 500, minHeight: '100vh' }}
      >
        <style>{globalCss}</style>
        {children}
      </body>
    </html>
  );
}
