import Link from 'next/link';

import { Logo } from '~/components/Logo';
import { t } from '~/i18n/t';

/** Wordmark, page links, the legal links (FR-PRV-04) and the copyright line. */
export function MarketingFooter() {
  return (
    <footer className="mk-foot">
      <div className="mk-wrap">
        <Logo height={20} />
        <ul aria-label={t('marketing.nav.label')}>
          <li>
            <Link href="/stickers">{t('marketing.nav.stickers')}</Link>
          </li>
          <li>
            <Link href="/#faq">{t('marketing.nav.faq')}</Link>
          </li>
          <li>
            <Link href="/waitlist">{t('marketing.nav.join')}</Link>
          </li>
        </ul>
        <ul aria-label={t('legal.footer')}>
          <li>
            <Link href="/terms">{t('legal.terms')}</Link>
          </li>
          <li>
            <Link href="/privacy">{t('legal.privacy')}</Link>
          </li>
          <li>
            <Link href="/guidelines">{t('legal.guidelines')}</Link>
          </li>
        </ul>
        <small>{t('marketing.footer.copyright')}</small>
      </div>
    </footer>
  );
}
