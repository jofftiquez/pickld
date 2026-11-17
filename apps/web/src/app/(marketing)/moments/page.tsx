import type { Metadata } from 'next';
import Image from 'next/image';

import { invite, slots } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { momentStickers } from '~/marketing/stickers';
import { WaitlistForm } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('marketing.moments.metaTitle'),
  description: t('marketing.moments.metaDescription'),
  alternates: { canonical: '/moments' },
};

const examples = ['e1', 'e2', 'e3', 'e4', 'e5'] as const;

/** The eight moments, one section each: its #tag, the app's caption question, what it's for and five ideas (FR-WEB-01). */
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
          <div className="mk-moments">
            {slots.map((slot) => (
              <section key={slot} id={slot} className="mk-moment" aria-labelledby={`${slot}-title`}>
                <div className="mk-moment-tag" style={{ background: invite.slotColors[slot] }}>
                  <h2 id={`${slot}-title`}>#{slot}</h2>
                  <p className="mk-moment-title">{t(`marketing.moments.${slot}.title`)}</p>
                  <p className="mk-moment-ask">
                    {t('marketing.moments.asks', { question: t(`marketing.moments.${slot}.question`) })}
                  </p>
                  <Image className="mk-moment-sticker" src={momentStickers[slot]} alt="" sizes="110px" />
                </div>
                <div className="mk-moment-body">
                  <p>{t(`marketing.moments.${slot}.body`)}</p>
                  <h3>{t('marketing.moments.ideas', { slot })}</h3>
                  <ul>
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
