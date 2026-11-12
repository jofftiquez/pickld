import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { FilterDefs } from '~/components/FilterDefs';
import { t } from '~/i18n/t';
import { siteUrl } from '~/lib/env';

const jakarta = localFont({
  src: [
    { path: '../fonts/PlusJakartaSans_500Medium.ttf', weight: '500' },
    { path: '../fonts/PlusJakartaSans_700Bold.ttf', weight: '700' },
    { path: '../fonts/PlusJakartaSans_800ExtraBold.ttf', weight: '800' },
  ],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: t('site.name'),
  description: t('site.tagline'),
};

export const viewport: Viewport = { themeColor: colors.surface, width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={jakarta.className}
        style={{ margin: 0, background: colors.background, color: colors.ink, fontWeight: 500 }}
      >
        <FilterDefs />
        <style>{`a{color:${colors.brandLink}}a:hover{opacity:.85}`}</style>
        <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
