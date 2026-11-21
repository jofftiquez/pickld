import Link from 'next/link';

import { Logo } from '~/components/Logo';
import { t } from '~/i18n/t';
import { waitlistOpen } from '~/lib/env';

type Column = { title: string; links: { href: string; label: string }[] };

/** Wordmark and tagline, the page links in three columns (with the legal links, FR-PRV-04) and the copyright line. */
export function MarketingFooter() {
  const columns: Column[] = [
    {
      title: t('marketing.footer.product'),
      links: [
        { href: '/moments', label: t('marketing.nav.moments') },
        { href: '/stickers', label: t('marketing.nav.stickers') },
        { href: '/#faq', label: t('marketing.nav.faq') },
        ...(waitlistOpen() ? [{ href: '/waitlist', label: t('marketing.nav.join') }] : []),
      ],
    },
    {
      title: t('marketing.footer.about'),
      links: [
        { href: '/why', label: t('marketing.nav.why') },
        { href: '/mission', label: t('marketing.nav.mission') },
        { href: '/story', label: t('marketing.nav.story') },
      ],
    },
    {
      title: t('legal.footer'),
      links: [
        { href: '/terms', label: t('legal.terms') },
        { href: '/privacy', label: t('legal.privacy') },
        { href: '/guidelines', label: t('legal.guidelines') },
      ],
    },
  ];
  return (
    <footer className="mk-foot">
      <div className="mk-wrap">
        <div className="mk-foot-main">
          <div className="mk-foot-brand">
            <Logo height={32} />
            <p>{t('marketing.footer.tagline')}</p>
            <p className="mk-foot-soon">{t('marketing.hero.eyebrow')}</p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="mk-foot-col">
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <small>{t('marketing.footer.copyright')}</small>
      </div>
    </footer>
  );
}
