import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { slots } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { Phone } from '~/marketing/Phone';
import * as shot from '~/marketing/shots';
import { pack, stickerLabel } from '~/marketing/stickers';
import { WaitlistForm } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('marketing.metaTitle'),
  description: t('marketing.metaDescription'),
  alternates: { canonical: '/' },
  openGraph: {
    title: t('marketing.metaTitle'),
    description: t('marketing.metaDescription'),
    siteName: t('site.name'),
    type: 'website',
    url: '/',
  },
};

const olivia = pack('olivia').stickers;
const faqs = ['free', 'android', 'who', 'full', 'missed', 'age'] as const;

/** pickld.me: what Pickld is, in real screenshots, with the waitlist (FR-WEB-01). */
export default function Home() {
  const queen = olivia.find((s) => s.name === 'queen')!;
  const hearts = olivia.find((s) => s.name === 'heart-eyes')!;
  return (
    <>
      <div className="mk-wrap mk-hero" id="join">
        <div>
          <p className="mk-eyebrow">{t('marketing.hero.eyebrow')}</p>
          <h1>
            {t('marketing.hero.title1')}
            <br />
            <span>{t('marketing.hero.title2')}</span>
          </h1>
          <p className="mk-lead">{t('marketing.hero.body')}</p>
          <WaitlistForm id="hero" source="hero" />
        </div>
        <div className="mk-art">
          <Phone src={shot.jar} alt={t('marketing.hero.jarAlt')} sizes="(min-width: 900px) 290px, 76vw" preload />
          <Image className="mk-float mk-float-a" src={queen.art} alt="" sizes="120px" />
          <Image className="mk-float mk-float-b" src={hearts.art} alt="" sizes="120px" />
        </div>
      </div>

      <section className="mk-section" aria-labelledby="moments">
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="moments">{t('marketing.moments.title')}</h2>
            <p>{t('marketing.moments.body')}</p>
          </div>
          <ul className="mk-chips" aria-label={t('marketing.moments.label')}>
            {slots.map((slot) => (
              <li key={slot} className="mk-chip">
                <b>#{slot}</b>
                <span>{t(`marketing.moments.${slot}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="how" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="how">{t('marketing.how.title')}</h2>
          </div>
          <ol className="mk-steps">
            {(
              [
                ['snap', shot.day],
                ['decorate', shot.filters],
                ['share', shot.story],
              ] as const
            ).map(([step, src]) => (
              <li key={step} className="mk-step">
                <h3>{t(`marketing.how.${step}Title`)}</h3>
                <p>{t(`marketing.how.${step}Body`)}</p>
                <Phone src={src} alt={t(`marketing.how.${step}Alt`)} sizes="(min-width: 900px) 240px, 64vw" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mk-section mk-dark" aria-labelledby="olivia">
        <div className="mk-wrap mk-split">
          <div>
            <p className="mk-eyebrow">{t('marketing.stickers.eyebrow')}</p>
            <h2 id="olivia">{t('marketing.stickers.title')}</h2>
            <p className="mk-lead" style={{ marginTop: 14 }}>
              {t('marketing.stickers.body')}
            </p>
            <ul className="mk-olivia" aria-label={t('marketing.stickers.oliviaLabel')}>
              {olivia.slice(0, 8).map((s) => (
                <li key={s.name}>
                  <Image src={s.art} alt={stickerLabel(s.name)} sizes="(min-width: 900px) 110px, 22vw" />
                </li>
              ))}
            </ul>
            <Link className="mk-link" href="/stickers">
              {t('marketing.stickers.cta')} →
            </Link>
          </div>
          <div className="mk-art">
            <Phone src={shot.pack} alt={t('marketing.stickers.packAlt')} sizes="(min-width: 900px) 290px, 76vw" />
          </div>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="privacy">
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="privacy">{t('marketing.privacy.title')}</h2>
            <p>{t('marketing.privacy.body')}</p>
          </div>
          <ul className="mk-cards">
            {(['readers', 'everyone', 'onlyMe'] as const).map((k) => (
              <li key={k} className="mk-card">
                <span className="mk-pill">{t(`marketing.privacy.${k}`)}</span>
                <p>{t(`marketing.privacy.${k}Body`)}</p>
              </li>
            ))}
          </ul>
          <p className="mk-note">{t('marketing.privacy.private')}</p>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="memories" style={{ paddingTop: 0 }}>
        <div className="mk-wrap mk-split mk-split-flip">
          <div>
            <h2 id="memories">{t('marketing.memories.title')}</h2>
            <p className="mk-lead" style={{ marginTop: 14 }}>
              {t('marketing.memories.body')}
            </p>
          </div>
          <div className="mk-pair">
            <Phone
              src={shot.memories}
              alt={t('marketing.memories.memoriesAlt')}
              sizes="(min-width: 900px) 230px, 42vw"
            />
            <Phone src={shot.widget} alt={t('marketing.memories.widgetAlt')} sizes="(min-width: 900px) 230px, 42vw" />
          </div>
        </div>
      </section>

      <section className="mk-section" id="faq" aria-labelledby="faq-title" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <h2 id="faq-title">{t('marketing.faq.title')}</h2>
          </div>
          <div className="mk-faq">
            {faqs.map((q) => (
              <details key={q}>
                <summary>{t(`marketing.faq.${q}Q`)}</summary>
                <p>{t(`marketing.faq.${q}A`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="final" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-final mk-dark">
            <h2 id="final">{t('marketing.final.title')}</h2>
            <p className="mk-lead">{t('marketing.final.body')}</p>
            <WaitlistForm id="final" source="final" />
          </div>
        </div>
      </section>
    </>
  );
}
