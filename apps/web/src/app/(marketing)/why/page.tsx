import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '~/components/Logo';
import { t } from '~/i18n/t';
import { WaitlistForm } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('why.metaTitle'),
  description: t('why.metaDescription'),
  alternates: { canonical: '/why' },
};

const lists = ['moments', 'jars', 'discover'] as const;
const nots = ['likes', 'strangers', 'filters', 'private', 'analytics', 'claim'] as const;
const controls = ['read', 'mute', 'block', 'discover', 'teens'] as const;
// Each study was opened and checked against its abstract before it was listed (title, venue, year, authors,
// findings and limits); see AGENTS.md "Honest copy".
const studies = [
  { key: 'nature', href: 'https://doi.org/10.1038/s41586-026-10098-2' },
  { key: 'science', href: 'https://doi.org/10.1126/science.abp9364' },
] as const;

/** Why Pickld, anchored in the first Pickld more than ten years ago: how each list decides what you see, what Pickld won't do, the controls, and the research behind it.
 * The page to share when pitching. Every claim matches what the app does today. */
export default function Why() {
  return (
    <>
      <div className="mk-wrap mk-hero">
        <div>
          <p className="mk-eyebrow">{t('why.eyebrow')}</p>
          <h1>
            {t('why.title1')} <span>{t('why.title2')}</span>
          </h1>
          <p className="mk-lead">{t('why.lead')}</p>
        </div>
        <figure className="mk-quote">
          <Logo height={34} />
          <blockquote>{t('why.promise')}</blockquote>
          <figcaption>{t('why.promiseBy')}</figcaption>
        </figure>
      </div>
      <section className="mk-section" aria-labelledby="how" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="how">{t('why.howTitle')}</h2>
            <p>{t('why.howBody')}</p>
          </div>
          <ul className="mk-cards">
            {lists.map((k) => (
              <li key={k} className="mk-card">
                <span className="mk-pill">{t(`why.how.${k}.title`)}</span>
                <p>{t(`why.how.${k}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="not" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="not">{t('why.notTitle')}</h2>
          </div>
          <ul className="mk-cards">
            {nots.map((k) => (
              <li key={k} className="mk-card">
                <p>{t(`why.not.${k}`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="control" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="control">{t('why.controlTitle')}</h2>
          </div>
          <ul className="mk-cards">
            {controls.map((k) => (
              <li key={k} className="mk-card">
                <p>{t(`why.control.${k}`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="research" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="research">{t('why.researchTitle')}</h2>
            <p>{t('why.researchBody')}</p>
          </div>
          <ul className="mk-cards">
            {studies.map(({ key, href }) => (
              <li key={key} className="mk-card">
                <h3>{t(`why.research.${key}.title`)}</h3>
                <p className="mk-note">{t(`why.research.${key}.source`)}</p>
                <p>{t(`why.research.${key}.summary`)}</p>
                <p>{t(`why.research.${key}.limit`)}</p>
                <a
                  className="mk-link"
                  href={href}
                  rel="noopener"
                  aria-label={t('why.readStudyLabel', { title: t(`why.research.${key}.title`) })}
                >
                  {t('why.readStudy')} →
                </a>
              </li>
            ))}
          </ul>
          <Link className="mk-link" href="/mission">
            {t('why.missionLink')} →
          </Link>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="final">
        <div className="mk-wrap">
          <div className="mk-final mk-dark">
            <h2 id="final">{t('why.finalTitle')}</h2>
            <p className="mk-lead">{t('why.finalBody')}</p>
            <WaitlistForm id="final" source="why" />
          </div>
        </div>
      </section>
    </>
  );
}
