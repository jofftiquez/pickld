import Link from 'next/link';
import { notFound } from 'next/navigation';

import { colors, radius } from '@/theme/tokens';

import { PackDetailsForm } from '~/components/PackDetailsForm';
import { PublishForm } from '~/components/PublishForm';
import { StatusPill } from '~/components/StatusPill';
import { StickerRow } from '~/components/StickerRow';
import { UploadArtForm } from '~/components/UploadArtForm';
import { t } from '~/i18n/t';
import { when } from '~/lib/audit';
import { artUrl, EDITABLE_TIER, loadPack, stickerArtBase } from '~/lib/stickers';
import { supabase } from '~/lib/supabase';

const note = {
  margin: 0,
  padding: '10px 14px',
  borderRadius: radius.card,
  background: colors.surface,
  fontSize: 13,
} as const;

// One pack in the Sticker Studio (FR-MOD-10): its details, art upload and publishing for free packs, and every
// sticker with its art. Premium, earned and seasonal packs are shown read-only.
export default async function StickerPack({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await supabase();
  const [found, base] = await Promise.all([loadPack(client, id), stickerArtBase(client)]);
  if (!found) notFound();
  const { pack, stickers } = found;
  const editable = pack.tier === EDITABLE_TIER;
  const draft = pack.status === 'draft';
  const live = stickers.filter((s) => s.retired_at === null).length;
  const retired = stickers.length - live;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      <Link href="/stickers" style={{ color: colors.muted, fontSize: 13, fontWeight: 600 }}>
        ← {t('stickers.pack.back')}
      </Link>
      <header style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{pack.name}</h1>
          <StatusPill status={pack.status} />
        </div>
        <p style={{ color: colors.muted, margin: 0, fontSize: 13 }}>
          {[
            `${t('stickers.pack.slug')}: ${pack.slug}`,
            t(`stickers.tier.${pack.tier}`),
            t('stickers.pack.live', { count: live }),
            ...(retired > 0 ? [t('stickers.pack.retiredCount', { count: retired })] : []),
            ...(pack.published_at ? [t('stickers.pack.publishedOn', { date: when(pack.published_at) })] : []),
          ].join(' · ')}
        </p>
      </header>
      {!editable ? (
        <p role="note" style={note}>
          {t('stickers.pack.readOnly', { tier: t(`stickers.tier.${pack.tier}`).toLowerCase() })}
        </p>
      ) : (
        <p role="note" style={note}>
          {t(draft ? 'stickers.pack.draftNote' : 'stickers.pack.publishedNote')}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16 }}>
        <section aria-label={t('stickers.list.stickers')} style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('stickers.list.stickers')}</h2>
          {stickers.length === 0 ? (
            <p style={{ ...note, color: colors.muted }}>{t('stickers.sticker.empty')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {stickers.map((s) => (
                <StickerRow key={s.id} sticker={s} art={base ? artUrl(base, s) : null} editable={editable} />
              ))}
            </ul>
          )}
        </section>
        {editable ? (
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <PackDetailsForm pack={pack.id} name={pack.name} description={pack.description ?? ''} />
            <UploadArtForm pack={pack.id} draft={draft} />
            <PublishForm pack={pack.id} draft={draft} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
