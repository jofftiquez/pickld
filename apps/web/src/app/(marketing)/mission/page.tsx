import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '~/components/Logo';
import { t } from '~/i18n/t';
import { WaitlistForm } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('mission.metaTitle'),
  description: t('mission.metaDescription'),
  alternates: { canonical: '/mission' },
};

const principles = ['people', 'choice', 'open', 'calm', 'safe', 'private'] as const;

/** Our mission: why Pickld exists and the rules it holds itself to (AGENTS.md "Product principles"). Always anchored in
 * the first Pickld, more than ten years ago: a simple way to keep your moments and be yourself (see /story). */
export default function Mission() {
  return (
    <>
      <div className="mk-wrap mk-hero">
        <div>
          <p className="mk-eyebrow">{t('mission.eyebrow')}</p>
          <h1>
            {t('mission.title1')} <span>{t('mission.title2')}</span>
          </h1>
          <p className="mk-lead">{t('mission.lead')}</p>
        </div>
        <figure className="mk-quote">
          <Logo height={34} />
          <blockquote>{t('mission.quote')}</blockquote>
          <figcaption>{t('mission.quoteBy')}</figcaption>
        </figure>
      </div>
      <section className="mk-section" aria-labelledby="origin" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="origin">{t('mission.originTitle')}</h2>
            <p>{t('mission.originBody')}</p>
          </div>
          <Link className="mk-link" href="/story">
            {t('mission.storyLink')} →
          </Link>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="principles" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="principles">{t('mission.principlesTitle')}</h2>
          </div>
          <ul className="mk-cards">
            {principles.map((k) => (
              <li key={k} className="mk-card">
                <h3>{t(`mission.principles.${k}.title`)}</h3>
                <p>{t(`mission.principles.${k}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="promise" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="promise">{t('mission.promiseTitle')}</h2>
            <p className="mk-lead">{t('mission.promise')}</p>
          </div>
          <Link className="mk-link" href="/why">
            {t('mission.whyLink')} →
          </Link>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="final">
        <div className="mk-wrap">
          <div className="mk-final mk-dark">
            <h2 id="final">{t('mission.finalTitle')}</h2>
            <p className="mk-lead">{t('mission.finalBody')}</p>
            <WaitlistForm id="final" source="mission" />
          </div>
        </div>
      </section>
    </>
  );
}
