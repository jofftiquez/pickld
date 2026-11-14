import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { CreatePackForm } from '~/components/CreatePackForm';
import { StatusPill } from '~/components/StatusPill';
import { t } from '~/i18n/t';
import { loadPackThumbs } from '~/lib/analytics';
import { EDITABLE_TIER, loadPacks } from '~/lib/stickers';
import { supabase } from '~/lib/supabase';

const grid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 100px 110px 90px 90px',
  gap: 12,
  alignItems: 'center',
};

// The Sticker Studio's pack list (FR-MOD-10; design: ModConsole lists "Sticker packs"): every pack, drafts
// first, and a form for a new free draft pack.
export default async function StickerPacks() {
  const client = await supabase();
  const [packs, thumbs] = await Promise.all([loadPacks(client), loadPackThumbs(client, 30)]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('stickers.title')}</h1>
        <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('stickers.subtitle')}</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16 }}>
        <section
          aria-label={t('stickers.list.label')}
          style={{ background: colors.surface, borderRadius: radius.card, overflow: 'hidden', alignSelf: 'start' }}
        >
          <div style={{ ...grid, padding: '12px 16px', fontSize: 12, fontWeight: 700, color: colors.muted }}>
            <span>{t('stickers.list.pack')}</span>
            <span>{t('stickers.list.tier')}</span>
            <span>{t('stickers.list.status')}</span>
            <span style={{ textAlign: 'right' }}>{t('stickers.list.stickers')}</span>
            <span style={{ textAlign: 'right' }}>{t('stickers.list.thumbs')}</span>
          </div>
          {packs.length === 0 ? (
            <p style={{ padding: 20, margin: 0, color: colors.muted }}>{t('stickers.list.empty')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {packs.map((p) => (
                <li key={p.id} style={{ borderTop: `1px solid ${colors.divider}` }}>
                  <Link
                    href={`/stickers/${p.id}`}
                    style={{ ...grid, padding: '12px 16px', color: colors.ink, textDecoration: 'none', fontSize: 14 }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, display: 'block' }}>{p.name}</span>
                      <span style={{ color: colors.muted, fontSize: 12 }}>
                        {p.slug}
                        {p.tier !== EDITABLE_TIER ? ` · ${t('stickers.list.readOnly')}` : ''}
                      </span>
                    </span>
                    <span style={{ color: colors.muted }}>{t(`stickers.tier.${p.tier}`)}</span>
                    <span>
                      <StatusPill status={p.status} />
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      {p.live}
                      {p.retired > 0 ? (
                        <span style={{ display: 'block', color: colors.muted, fontSize: 12 }}>
                          {t('stickers.list.retiredCount', { count: p.retired })}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ textAlign: 'right' }}>{thumbs.get(p.id)?.thumbs ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div style={{ alignSelf: 'start' }}>
          <CreatePackForm />
        </div>
      </div>
    </div>
  );
}
