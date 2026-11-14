import Link from 'next/link';

import { Logo } from '~/components/Logo';
import { t } from '~/i18n/t';

/** The marketing pages' top bar: wordmark, Stickers, Our story, FAQ and Join the waitlist. */
export function MarketingHeader() {
  return (
    <header className="mk-top">
      <div className="mk-wrap">
        <Link
          href="/"
          aria-label={t('marketing.nav.home')}
          style={{ display: 'flex', minHeight: 44, alignItems: 'center' }}
        >
          <Logo height={24} />
        </Link>
        <nav aria-label={t('marketing.nav.label')}>
          <ul className="mk-nav">
            <li>
              <Link href="/stickers">{t('marketing.nav.stickers')}</Link>
            </li>
            <li className="mk-wide">
              <Link href="/story">{t('marketing.nav.story')}</Link>
            </li>
            <li className="mk-wide">
              <Link href="/#faq">{t('marketing.nav.faq')}</Link>
            </li>
            <li>
              <Link className="mk-btn" href="/#join">
                {t('marketing.nav.join')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
