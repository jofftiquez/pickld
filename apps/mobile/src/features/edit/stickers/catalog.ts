import { z } from 'zod';

import type { Slot } from '@/theme/tokens';

import { stickerStamps, type Overlay } from '../edits';
import { stickerArtFor } from './stickerArt';

// The sticker catalog as the Stickers tool shows it (FR-STK-01, FR-STK-02, FR-STK-03; architecture: "the
// current slot's suggestions first (slot_hint plus onboarding answers), then owned packs in the user's
// order"). Rows come from Supabase (0012), so packs added on the server appear without an app update.
// Who may use what is the database's answer (pack_usable, sticker_usable); the app only follows it.

const slotSchema = z.enum([
  'whereami',
  'mebusywith',
  'whoamiwith',
  'ootd',
  'selfie',
  'morning',
  'afternoon',
  'evening',
]) satisfies z.ZodType<Slot>;

export const packRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  sort: z.number(),
  // What a pack is for sale as (0001, 0029); a row without them is a pack that isn't sold.
  tier: z.enum(['free', 'premium', 'earned', 'seasonal']).catch('free'),
  store_product_id: z.string().nullable().default(null),
  available_from: z.string().nullable().default(null),
  available_to: z.string().nullable().default(null),
  // Computed field; null only if the server couldn't answer, which is treated as not usable.
  pack_usable: z.boolean().nullable(),
});

export const stickerRowSchema = z.object({
  id: z.guid(),
  pack_id: z.string(),
  label: z.string().min(1).max(60),
  asset_path: z.string(),
  tags: z.array(z.string()),
  slot_hint: slotSchema.nullable(),
  // A stamp kind this app doesn't know yet is drawn as plain art.
  stamp: z.enum(stickerStamps).nullable().catch(null),
  milestone_key: z.string().nullable(),
  sort: z.number(),
  sticker_usable: z.boolean().nullable(),
});

export const answersRowSchema = z.object({
  day_type: z.string().nullable(),
  whoamiwith: z.array(z.string()),
  mebusywith: z.array(z.string()),
  ootd: z.string().nullable(),
});

export type PackRow = z.infer<typeof packRowSchema>;
export type StickerRow = z.infer<typeof stickerRowSchema>;
export type AnswersRow = z.infer<typeof answersRowSchema>;

export type CatalogSticker = {
  id: string;
  label: string;
  asset: string;
  tags: readonly string[];
  slotHint: Slot | null;
  stamp: (typeof stickerStamps)[number] | null;
};

export type CatalogPack = { id: string; slug: string; name: string; stickers: CatalogSticker[] };

/** A pack for sale that the user doesn't own: a locked tab that opens Pack preview (FR-STK-06). */
export type LockedPack = { id: string; slug: string; name: string; productId: string; seasonal: boolean };

export type StickerCatalog = {
  /** Usable packs in catalog order, each with only the stickers the user may add. */
  packs: CatalogPack[];
  /** Packs on sale that the user doesn't own, in catalog order; their stickers are never offered. */
  locked: LockedPack[];
  /** Words from the onboarding answers, in the catalog's tag form (e.g. "side_hustle"). */
  interests: string[];
};

/** "Side hustle" → "side_hustle": the onboarding chip values in the form the catalog's tags use. */
export function toTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function interestsFrom(answers: AnswersRow | null): string[] {
  if (!answers) return [];
  const values = [answers.day_type, answers.ootd, ...answers.whoamiwith, ...answers.mebusywith];
  return [...new Set(values.flatMap((v) => (v === null ? [] : [toTag(v)])).filter((v) => v !== ''))];
}

/** Sold right now: a paid pack with a store product, inside its sale window (0029). */
export function isOnSale(
  pack: Pick<PackRow, 'tier' | 'store_product_id' | 'available_from' | 'available_to'>,
  now: Date,
): boolean {
  if ((pack.tier !== 'premium' && pack.tier !== 'seasonal') || pack.store_product_id === null) return false;
  const t = now.getTime();
  if (pack.available_from !== null && Date.parse(pack.available_from) > t) return false;
  if (pack.available_to !== null && Date.parse(pack.available_to) <= t) return false;
  return true;
}

/**
 * Builds the catalog from the server rows. Rows that don't parse are dropped one by one. A pack's stickers
 * show only if the user may use it and it has a sticker they may add (a pack on sale that they don't own
 * is listed in `locked` instead, without stickers); within it, a sticker shows only if
 * sticker_usable (so an unearned milestone stays out) and this app has its art.
 */
export function buildCatalog(
  packRows: unknown[],
  stickerRows: unknown[],
  answers: unknown,
  now: Date = new Date(),
): StickerCatalog {
  const parsedPacks = packRows
    .flatMap((row) => {
      const parsed = packRowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => a.sort - b.sort);
  const locked = parsedPacks
    .filter((pack) => pack.pack_usable !== true && isOnSale(pack, now))
    .map((pack): LockedPack => ({
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      productId: pack.store_product_id ?? '',
      seasonal: pack.tier === 'seasonal',
    }));
  const stickers = stickerRows.flatMap((row) => {
    const parsed = stickerRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  const packs = parsedPacks
    .filter((pack) => pack.pack_usable === true)
    .map((pack): CatalogPack => ({
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      stickers: stickers
        .filter((s) => s.pack_id === pack.id && s.sticker_usable === true)
        // TODO(FR-STK-02 follow-up): art for packs added after this app version, from the photo worker
        // (D-25); until then a sticker with no bundled art is not offered.
        .filter((s) => stickerArtFor(s.asset_path) !== undefined)
        .sort((a, b) => a.sort - b.sort)
        .map((s) => ({
          id: s.id,
          label: s.label,
          asset: s.asset_path,
          tags: s.tags,
          slotHint: s.slot_hint,
          stamp: s.stamp,
        })),
    }))
    .filter((pack) => pack.stickers.length > 0);
  const parsedAnswers = answersRowSchema.safeParse(answers);
  return { packs, locked, interests: interestsFrom(parsedAnswers.success ? parsedAnswers.data : null) };
}

/**
 * The "For #slot" row (FR-STK-03): every addable sticker whose hint is this slot, those matching more of
 * the onboarding answers first, otherwise in catalog order (pack, then sticker).
 */
export function suggestionsFor(catalog: StickerCatalog, slot: Slot): CatalogSticker[] {
  const interests = new Set(catalog.interests);
  const score = (s: CatalogSticker) => s.tags.filter((tag) => interests.has(tag)).length;
  return catalog.packs
    .flatMap((pack) => pack.stickers)
    .filter((s) => s.slotHint === slot)
    .map((sticker, index) => ({ sticker, index, score: score(sticker) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.sticker);
}

/** Where a new sticker starts: the centre of the photo, upright, about a third of its width (design: Stickers). */
export const STICKER_START = { x: 0.5, y: 0.5, scale: 0.36, rotation: 0 } as const;

/** The overlay a tap on a sticker adds. */
export function stickerOverlay(sticker: CatalogSticker, id: string): Overlay {
  return {
    id,
    type: 'sticker',
    ...STICKER_START,
    stickerId: sticker.id,
    asset: sticker.asset,
    label: sticker.label,
    ...(sticker.stamp === null ? null : { stamp: sticker.stamp }),
  };
}
