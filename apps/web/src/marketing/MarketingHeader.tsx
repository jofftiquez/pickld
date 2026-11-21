import Link from 'next/link';

import { Logo } from '~/components/Logo';
import { t } from '~/i18n/t';
import { waitlistOpen } from '~/lib/env';
import { MarketingMenu } from '~/marketing/MarketingMenu';

/**
 * The marketing pages' top bar: wordmark, then Why Pickld, Stickers, Our story and FAQ from tablet width up, or a
 * Menu with every page on phones; Join the waitlist (while it is open) on both.
 */
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
        <nav aria-label={t('marketing.nav.label')} className="mk-topnav">
          <ul className="mk-nav">
            <li className="mk-wide">
              <Link href="/why">{t('marketing.nav.why')}</Link>
            </li>
            <li className="mk-wide">
              <Link href="/stickers">{t('marketing.nav.stickers')}</Link>
            </li>
            <li className="mk-wide">
              <Link href="/story">{t('marketing.nav.story')}</Link>
            </li>
            <li className="mk-wide">
              <Link href="/#faq">{t('marketing.nav.faq')}</Link>
            </li>
            {waitlistOpen() && (
              <li>
                <Link className="mk-btn" href="/#join">
                  {t('marketing.nav.join')}
                </Link>
              </li>
            )}
          </ul>
          <MarketingMenu
            label={t('marketing.nav.menu')}
            links={[
              { href: '/moments', label: t('marketing.nav.moments') },
              { href: '/why', label: t('marketing.nav.why') },
              { href: '/mission', label: t('marketing.nav.mission') },
              { href: '/stickers', label: t('marketing.nav.stickers') },
              { href: '/story', label: t('marketing.nav.story') },
              { href: '/#faq', label: t('marketing.nav.faq') },
            ]}
          />
        </nav>
      </div>
    </header>
  );
}
