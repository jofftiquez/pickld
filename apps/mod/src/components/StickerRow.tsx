'use client';

import { useActionState } from 'react';

import { colors, radius } from '@/theme/tokens';

import { editSticker, setRetired } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import { SLOTS, type Sticker, type StickerResult, stickerName } from '~/lib/stickers';
import { input, secondaryButton } from '~/lib/styles';

import { ResultNote } from './ResultNote';

const field = { display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: colors.muted } as const;
const small = {
  ...input,
  fontSize: 14,
  padding: '9px 10px',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
} as const;

/** One sticker in the Studio: its art, size and version, and (free packs) its label, tags, slot and retirement. */
export function StickerRow({ sticker, art, editable }: { sticker: Sticker; art: string | null; editable: boolean }) {
  const [saved, save, saving] = useActionState<StickerResult | null, FormData>(editSticker, null);
  const [retired, retire, retiring] = useActionState<StickerResult | null, FormData>(setRetired, null);
  const isRetired = sticker.retired_at !== null;
  const name = stickerName(sticker.asset_path);
  return (
    <li
      aria-label={sticker.label}
      style={{
        display: 'grid',
        gridTemplateColumns: '96px minmax(0, 1fr)',
        gap: 14,
        padding: 14,
        background: colors.surface,
        borderRadius: radius.card,
        opacity: isRetired ? 0.7 : 1,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: radius.thumbLg,
          // A light checkerboard shows the art's transparent edges.
          background: `repeating-conic-gradient(${colors.subtle} 0% 25%, ${colors.surface} 0% 50%) 0 0 / 16px 16px`,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        {art ? (
          <img
            src={art}
            alt={t('stickers.sticker.artLabel', { label: sticker.label })}
            style={{ maxWidth: 88, maxHeight: 88, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>{t('stickers.sticker.noArt')}</span>
        )}
      </div>
      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <p style={{ margin: 0, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 13 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{name}</span>
          <span style={{ color: colors.muted }}>
            {sticker.art_width && sticker.art_height
              ? t('stickers.sticker.size', { w: sticker.art_width, h: sticker.art_height })
              : t('stickers.sticker.noSize')}
          </span>
          <span style={{ color: colors.muted }}>{t('stickers.sticker.version', { v: sticker.art_version })}</span>
          {isRetired ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.likeText,
                background: colors.dangerTint,
                borderRadius: radius.pill,
                padding: '3px 8px',
              }}
            >
              {t('stickers.sticker.retired')}
            </span>
          ) : null}
        </p>
        {editable ? (
          <>
            <form
              action={save}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr) auto',
                gap: 8,
                alignItems: 'end',
              }}
            >
              <input type="hidden" name="sticker" value={sticker.id} />
              <label style={field}>
                {t('stickers.sticker.label')}
                <input name="label" required maxLength={40} defaultValue={sticker.label} style={small} />
              </label>
              <label style={field}>
                {t('stickers.sticker.tags')}
                <input name="tags" maxLength={400} defaultValue={sticker.tags.join(', ')} style={small} />
              </label>
              <label style={field}>
                {t('stickers.sticker.slot')}
                <select name="slot" defaultValue={sticker.slot_hint ?? ''} style={small}>
                  <option value="">{t('stickers.sticker.noSlot')}</option>
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`stickers.slot.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={saving}
                aria-label={`${t('stickers.sticker.save')} ${sticker.label}`}
                style={{ ...secondaryButton, minHeight: 42, opacity: saving ? 0.6 : 1 }}
              >
                {t('stickers.sticker.save')}
              </button>
            </form>
            <form action={retire} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="hidden" name="sticker" value={sticker.id} />
              <input type="hidden" name="retired" value={isRetired ? '0' : '1'} />
              <button
                type="submit"
                disabled={retiring}
                aria-label={`${t(isRetired ? 'stickers.sticker.restore' : 'stickers.sticker.retire')} ${sticker.label}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  color: isRetired ? colors.brandLink : colors.danger,
                  opacity: retiring ? 0.6 : 1,
                }}
              >
                {t(isRetired ? 'stickers.sticker.restore' : 'stickers.sticker.retire')}
              </button>
              <ResultNote result={saved} />
              <ResultNote result={retired} />
            </form>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>{sticker.label}</strong>
            {sticker.tags.length > 0 ? <span style={{ color: colors.muted }}> · {sticker.tags.join(', ')}</span> : null}
            {sticker.slot_hint ? (
              <span style={{ color: colors.muted }}> · {t(`stickers.slot.${sticker.slot_hint}`)}</span>
            ) : null}
          </p>
        )}
      </div>
    </li>
  );
}
