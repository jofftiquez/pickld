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
    { path: '../fonts/PlusJakartaSans_600SemiBold.ttf', weight: '600' },
    { path: '../fonts/PlusJakartaSans_700Bold.ttf', weight: '700' },
    { path: '../fonts/PlusJakartaSans_800ExtraBold.ttf', weight: '800' },
  ],
  display: 'swap',
  variable: '--font-jakarta',
});

// The text tool's display faces, as the app bundles them; MomentPhoto names them by these variables.
const script = localFont({ src: '../fonts/Pacifico-Regular.ttf', variable: '--font-script', display: 'swap' });
const strong = localFont({ src: '../fonts/Anton-Regular.ttf', variable: '--font-strong', display: 'swap' });
const marker = localFont({ src: '../fonts/PermanentMarker-Regular.ttf', variable: '--font-marker', display: 'swap' });
const hand = localFont({ src: '../fonts/CaveatBrush-Regular.ttf', variable: '--font-hand', display: 'swap' });

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
        className={[
          jakarta.className,
          jakarta.variable,
          script.variable,
          strong.variable,
          marker.variable,
          hand.variable,
        ].join(' ')}
        style={{ margin: 0, background: colors.background, color: colors.ink, fontWeight: 500 }}
      >
        <FilterDefs />
        <style>{`a{color:${colors.brandLink}}a:hover{opacity:.85}`}</style>
        {children}
      </body>
    </html>
  );
}
