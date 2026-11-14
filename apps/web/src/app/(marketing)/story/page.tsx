import type { Metadata } from 'next';

import { Logo } from '~/components/Logo';
import { t } from '~/i18n/t';
import { WaitlistForm } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('story.metaTitle'),
  description: t('story.metaDescription'),
  alternates: { canonical: '/story' },
};

const steps = ['first', 'calling', 'promise', 'now'] as const;

/** Our story: the first Pickld more than ten years ago, the pivot to healthcare technology, and the return. */
export default function Story() {
  return (
    <>
      <div className="mk-wrap mk-hero">
        <div>
          <p className="mk-eyebrow">{t('story.eyebrow')}</p>
          <h1>
            {t('story.title1')} <span>{t('story.title2')}</span>
          </h1>
          <p className="mk-lead">{t('story.lead')}</p>
        </div>
        <figure className="mk-quote">
          <Logo height={34} />
          <blockquote>{t('story.quote')}</blockquote>
          <figcaption>{t('story.quoteBy')}</figcaption>
        </figure>
      </div>
      <section className="mk-section" aria-label={t('story.timelineLabel')} style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <ol className="mk-timeline">
            {steps.map((step) => (
              <li key={step}>
                <p className="mk-when">{t(`story.steps.${step}.when`)}</p>
                <h2>{t(`story.steps.${step}.title`)}</h2>
                <p>{t(`story.steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="mk-section" aria-labelledby="final">
        <div className="mk-wrap">
          <div className="mk-final mk-dark">
            <h2 id="final">{t('story.finalTitle')}</h2>
            <p className="mk-lead">{t('story.finalBody')}</p>
            <WaitlistForm id="final" source="story" />
          </div>
        </div>
      </section>
    </>
  );
}
