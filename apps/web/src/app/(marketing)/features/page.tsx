import type { Metadata } from 'next';
import Link from 'next/link';

import { t } from '~/i18n/t';
import { Phone } from '~/marketing/Phone';
import * as shot from '~/marketing/shots';
import { WaitlistForm, waitlistText } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('features.metaTitle'),
  description: t('features.metaDescription'),
  alternates: { canonical: '/features' },
};

const spotlights = [
  ['close', shot.closeFriends],
  ['calm', shot.calm],
] as const;
const points = ['p1', 'p2', 'p3'] as const;
const more = ['private', 'widget', 'describe', 'mention', 'place', 'straighten'] as const;

/**
 * New in Pickld: a few of the newest features in real screenshots, not the whole list (the rest wait for launch).
 * Every line describes what the app does today (AGENTS.md "Honest copy").
 */
export default function Features() {
  return (
    <>
      <div className="mk-wrap mk-hero">
        <div>
          <p className="mk-eyebrow">{t('features.eyebrow')}</p>
          <h1>
            {t('features.title1')}
            <br />
            <span>{t('features.title2')}</span>
          </h1>
          <p className="mk-lead">{t('features.lead')}</p>
        </div>
        <div className="mk-art">
          <Phone src={shot.today} alt={t('features.heroAlt')} sizes="(min-width: 900px) 290px, 76vw" preload />
        </div>
      </div>
      <section className="mk-section" aria-labelledby="spotlight" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <h2 id="spotlight" className="mk-sr">
            {t('features.spotlightTitle')}
          </h2>
          <ol className="mk-panels" style={{ listStyle: 'none' }}>
            {spotlights.map(([key, src], i) => (
              <li key={key} className={`mk-panel mk-split${i % 2 ? ' mk-split-flip' : ''}`}>
                <div>
                  <span className="mk-pill-new">{t(`features.${key}.tag`)}</span>
                  <h3>{t(`features.${key}.title`)}</h3>
                  <p className="mk-lead">{t(`features.${key}.body`)}</p>
                  <ul className="mk-points">
                    {points.map((p) => (
                      <li key={p}>{t(`features.${key}.${p}`)}</li>
                    ))}
                  </ul>
                </div>
                <div className="mk-art">
                  <Phone src={src} alt={t(`features.${key}.alt`)} sizes="(min-width: 900px) 260px, 64vw" />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="more" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="more">{t('features.moreTitle')}</h2>
            <p>{t('features.moreBody')}</p>
          </div>
          <ul className="mk-cards">
            {more.map((k) => (
              <li key={k} className="mk-card">
                <h3>{t(`features.more.${k}.title`)}</h3>
                <p>{t(`features.more.${k}.body`)}</p>
              </li>
            ))}
          </ul>
          <p className="mk-lead" style={{ marginTop: 28 }}>
            <strong>{t('features.saving')}</strong>
          </p>
          <Link className="mk-link" href="/moments">
            {t('features.momentsLink')} →
          </Link>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="final" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-final mk-dark">
            <h2 id="final">{t('features.finalTitle')}</h2>
            <p className="mk-lead">{waitlistText('features.finalBody')}</p>
            <WaitlistForm id="final" source="features" />
          </div>
        </div>
      </section>
    </>
  );
}
