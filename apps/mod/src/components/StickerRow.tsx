'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { editSticker, setRetired } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import { SLOTS, type Sticker, type StickerResult, stickerName } from '~/lib/stickers';
import { cn } from '~/lib/utils';

import { ResultNote } from './ResultNote';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect, NativeSelectOption } from './ui/native-select';

const field = 'grid min-w-0 gap-1 text-xs font-bold text-muted-foreground';

/** One sticker in the Studio: its art, size and version, and (free packs) its label, tags, slot and retirement. */
export function StickerRow({ sticker, art, editable }: { sticker: Sticker; art: string | null; editable: boolean }) {
  const [saved, save, saving] = useActionState<StickerResult | null, FormData>(editSticker, null);
  const [retired, retire, retiring] = useActionState<StickerResult | null, FormData>(setRetired, null);
  const isRetired = sticker.retired_at !== null;
  const name = stickerName(sticker.asset_path);
  return (
    <li
      aria-label={sticker.label}
      className={cn(
        'grid grid-cols-[96px_minmax(0,1fr)] gap-3.5 rounded-card border bg-card p-3.5 shadow-xs',
        isRetired && 'opacity-70',
      )}
    >
      <div
        className="grid size-24 place-items-center overflow-hidden rounded-tile"
        // A light checkerboard shows the art's transparent edges.
        style={{
          background: `repeating-conic-gradient(${colors.subtle} 0% 25%, ${colors.surface} 0% 50%) 0 0 / 16px 16px`,
        }}
      >
        {art ? (
          <img
            src={art}
            alt={t('stickers.sticker.artLabel', { label: sticker.label })}
            className="max-h-[88px] max-w-[88px] object-contain"
          />
        ) : (
          <span className="text-center text-[11px] text-muted-foreground">{t('stickers.sticker.noArt')}</span>
        )}
      </div>
      <div className="grid min-w-0 gap-2">
        <p className="m-0 flex flex-wrap items-baseline gap-2 text-[13px]">
          <span className="text-[15px] font-extrabold">{name}</span>
          <span className="text-muted-foreground">
            {sticker.art_width && sticker.art_height
              ? t('stickers.sticker.size', { w: sticker.art_width, h: sticker.art_height })
              : t('stickers.sticker.noSize')}
          </span>
          <span className="text-muted-foreground">{t('stickers.sticker.version', { v: sticker.art_version })}</span>
          {isRetired ? (
            <Badge className="border-transparent bg-destructive-tint text-destructive-text">
              {t('stickers.sticker.retired')}
            </Badge>
          ) : null}
        </p>
        {editable ? (
          <>
            <form
              action={save}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-end gap-2"
            >
              <input type="hidden" name="sticker" value={sticker.id} />
              <label className={field}>
                {t('stickers.sticker.label')}
                <Input name="label" required maxLength={40} defaultValue={sticker.label} className="text-foreground" />
              </label>
              <label className={field}>
                {t('stickers.sticker.tags')}
                <Input name="tags" maxLength={400} defaultValue={sticker.tags.join(', ')} className="text-foreground" />
              </label>
              <label className={field}>
                {t('stickers.sticker.slot')}
                <NativeSelect
                  name="slot"
                  defaultValue={sticker.slot_hint ?? ''}
                  wrapperClassName="w-full"
                  className="text-foreground"
                >
                  <NativeSelectOption value="">{t('stickers.sticker.noSlot')}</NativeSelectOption>
                  {SLOTS.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {t(`stickers.slot.${s}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <Button
                type="submit"
                variant="secondary"
                disabled={saving}
                aria-label={`${t('stickers.sticker.save')} ${sticker.label}`}
              >
                {t('stickers.sticker.save')}
              </Button>
            </form>
            <form action={retire} className="flex flex-wrap items-center gap-2.5">
              <input type="hidden" name="sticker" value={sticker.id} />
              <input type="hidden" name="retired" value={isRetired ? '0' : '1'} />
              <Button
                type="submit"
                variant="link"
                disabled={retiring}
                aria-label={`${t(isRetired ? 'stickers.sticker.restore' : 'stickers.sticker.retire')} ${sticker.label}`}
                className={cn('h-11 px-0 text-[13px]', isRetired ? 'text-link' : 'text-destructive')}
              >
                {t(isRetired ? 'stickers.sticker.restore' : 'stickers.sticker.retire')}
              </Button>
              <ResultNote result={saved} />
              <ResultNote result={retired} />
            </form>
          </>
        ) : (
          <p className="m-0 text-sm">
            <strong>{sticker.label}</strong>
            {sticker.tags.length > 0 ? (
              <span className="text-muted-foreground"> · {sticker.tags.join(', ')}</span>
            ) : null}
            {sticker.slot_hint ? (
              <span className="text-muted-foreground"> · {t(`stickers.slot.${sticker.slot_hint}`)}</span>
            ) : null}
          </p>
        )}
      </div>
    </li>
  );
}
