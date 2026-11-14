import type { ReactNode } from 'react';

import { t } from '~/i18n/t';
import { MarketingFooter } from '~/marketing/MarketingFooter';
import { MarketingHeader } from '~/marketing/MarketingHeader';
import { css } from '~/marketing/styles';

/** The marketing pages (pickld.me home, Stickers, Join the waitlist): full width, unlike the shared-link pages. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mk">
      <style>{css}</style>
      <a className="mk-skip" href="#main">
        {t('marketing.skip')}
      </a>
      <MarketingHeader />
      <main id="main" style={{ flex: 1 }}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
