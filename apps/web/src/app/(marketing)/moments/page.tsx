import type { Metadata } from 'next';

import { invite, slots } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { MomentFan } from '~/marketing/MomentFan';
import { WaitlistForm } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('marketing.moments.metaTitle'),
  description: t('marketing.moments.metaDescription'),
  alternates: { canonical: '/moments' },
};

const examples = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'] as const;

/** The eight moments in the home page's fanned rows, each with the app's question, a longer description and ideas (FR-WEB-01). */
export default function Moments() {
  return (
    <>
      <div className="mk-wrap mk-hero">
        <div>
          <p className="mk-eyebrow">{t('marketing.moments.eyebrow')}</p>
          <h1>{t('marketing.moments.title')}</h1>
          <p className="mk-lead">{t('marketing.moments.body')}</p>
        </div>
      </div>
      <section className="mk-section" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <ul className="mk-chips" aria-label={t('marketing.moments.label')}>
            {slots.map((slot) => (
              <li key={slot}>
                <a className="mk-chip" href={`#${slot}`}>
                  <b>#{slot}</b>
                  <span>{t(`marketing.moments.${slot}.title`)}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mk-rows mk-rows-page">
            {slots.map((slot, i) => (
              <section
                key={slot}
                id={slot}
                className={`mk-row${i % 2 ? ' mk-row-flip' : ''}`}
                aria-labelledby={`${slot}-title`}
              >
                <MomentFan slot={slot} />
                <div className="mk-row-text">
                  <h2 id={`${slot}-title`} style={{ color: invite.slotColors[slot] }}>
                    #{slot}
                  </h2>
                  <h3>{t(`marketing.moments.${slot}.title`)}</h3>
                  <p className="mk-row-ask">
                    {t('marketing.moments.asks', { question: t(`marketing.moments.${slot}.question`) })}
                  </p>
                  <p>{t(`marketing.moments.${slot}.long`)}</p>
                  <h4>{t('marketing.moments.ideasTitle')}</h4>
                  <ul className="mk-ideas">
                    {examples.map((e) => (
                      <li key={e}>{t(`marketing.moments.${slot}.${e}`)}</li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
          <p className="mk-note mk-moments-outro">{t('marketing.moments.outro')}</p>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="final" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-final mk-dark">
            <h2 id="final">{t('marketing.final.title')}</h2>
            <p className="mk-lead">{t('marketing.final.body')}</p>
            <WaitlistForm id="final" source="moments" />
          </div>
        </div>
      </section>
    </>
  );
}
