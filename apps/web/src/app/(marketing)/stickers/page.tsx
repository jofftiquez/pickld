import type { Metadata } from 'next';
import Image from 'next/image';

import { t } from '~/i18n/t';
import { Phone } from '~/marketing/Phone';
import * as shot from '~/marketing/shots';
import { packs, stickerLabel } from '~/marketing/stickers';
import { WaitlistForm } from '~/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: t('stickers.metaTitle'),
  description: t('stickers.metaDescription'),
  alternates: { canonical: '/stickers' },
};

/** Every sticker pack, Olivia first, with a few of its stickers and whether it's free, earned, limited or paid. */
export default function Stickers() {
  return (
    <>
      <div className="mk-wrap mk-hero">
        <div>
          <p className="mk-eyebrow">{t('marketing.stickers.eyebrow')}</p>
          <h1 style={{ fontSize: 'clamp(38px,8vw,64px)' }}>{t('stickers.title')}</h1>
          <p className="mk-lead">{t('stickers.body')}</p>
          <p className="mk-note">{t('stickers.note')}</p>
        </div>
        <div className="mk-pair">
          <Phone src={shot.stickers} alt={t('stickers.editorAlt')} sizes="(min-width: 900px) 230px, 42vw" preload />
          <Phone src={shot.pack} alt={t('stickers.packAlt')} sizes="(min-width: 900px) 230px, 42vw" />
        </div>
      </div>
      <div className="mk-wrap">
        <div className="mk-packs">
          {packs.map((p) => {
            const name = t(`stickers.packs.${p.slug}.name`);
            return (
              <section key={p.slug} className="mk-pack" aria-labelledby={`pack-${p.slug}`}>
                <div className="mk-pack-head">
                  <h2 id={`pack-${p.slug}`} style={{ fontSize: 24 }}>
                    {name}
                  </h2>
                  <span className={`mk-kind mk-kind-${p.kind}`}>{t(`stickers.kind.${p.kind}`)}</span>
                  <p>{t(`stickers.packs.${p.slug}.description`)}</p>
                </div>
                <ul className="mk-grid" aria-label={t('stickers.packLabel', { name })}>
                  {p.stickers.map((s) => (
                    <li key={s.name}>
                      <Image src={s.art} alt={stickerLabel(s.name)} sizes="(min-width: 720px) 160px, 30vw" />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <section className="mk-section" aria-labelledby="final">
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
