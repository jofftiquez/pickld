import { z } from 'zod';

import { answersRowSchema, isOnSale, packRowSchema, stickerRowSchema, toTag } from '@/features/edit/stickers/catalog';

// The Sticker shop (FR-STK-06; design: StickerShop): the seasonal banner, the "For you" row of packs for sale
// that match the onboarding answers, and the packs the user already has ("Yours"). The server says what the
// user may use (pack_usable) and what a pack is (tier, store product, sale window, 0029); this file only
// arranges it. Prices are the store's (src/lib/store), never the database's.

export const shopPackRowSchema = packRowSchema.extend({ description: z.string().nullable().default(null) });

export type ShopPackRow = z.infer<typeof shopPackRowSchema>;

export type ShopPack = {
  id: string;
  slug: string;
  name: string;
  tier: ShopPackRow['tier'];
  description: string | null;
  /** The store product a purchase unlocks; null for free and earned packs. */
  productId: string | null;
  stickerCount: number;
  /** Every sticker in catalog order (cards show the first three). */
  stickers: { asset: string; label: string }[];
  /** Every sticker label, for search. */
  labels: string[];
  tags: string[];
  /** The user may use it (free, earned or bought). */
  owned: boolean;
  /** Sold right now: a paid pack inside its sale window. */
  onSale: boolean;
  /** When the sale window closes (seasonal packs), as an ISO timestamp. */
  availableTo: string | null;
};

/** An onboarding answer that put a pack in "For you", e.g. { group: 'whoamiwith', key: 'barkada' }. */
export type ShopReason = { group: 'whoamiwith' | 'mebusywith' | 'ootd'; key: string };

export type Shop = {
  /** The seasonal pack on sale that the user doesn't own yet (the banner), if any. */
  seasonal: ShopPack | null;
  /** Paid packs on sale that the user doesn't own, best matches first. */
  forYou: ShopPack[];
  /** Up to two answers behind "For you" ("Because you picked Barkada and Work"); empty when none match. */
  reasons: ShopReason[];
  /** Packs the user may use, in catalog order. */
  yours: ShopPack[];
};

function parseAll<T>(schema: z.ZodType<T>, rows: unknown[]): T[] {
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Folds case and accents so "noche" finds "Noche Buena" and "pasko" finds "Pásko". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesQuery(pack: ShopPack, query: string): boolean {
  const q = fold(query.trim());
  if (q === '') return true;
  return [pack.name, ...pack.labels, ...pack.tags].some((text) => fold(text).includes(q));
}

export function buildPacks(packRows: unknown[], stickerRows: unknown[], now: Date): ShopPack[] {
  const stickers = parseAll(stickerRowSchema, stickerRows);
  return parseAll(shopPackRowSchema, packRows)
    .sort((a, b) => a.sort - b.sort)
    .map((pack) => {
      const own = stickers.filter((s) => s.pack_id === pack.id).sort((a, b) => a.sort - b.sort);
      return {
        id: pack.id,
        slug: pack.slug,
        name: pack.name,
        tier: pack.tier,
        description: pack.description,
        productId: pack.store_product_id,
        stickerCount: own.length,
        stickers: own.map((s) => ({ asset: s.asset_path, label: s.label })),
        labels: own.map((s) => s.label),
        tags: [...new Set(own.flatMap((s) => s.tags))],
        owned: pack.pack_usable === true,
        onSale: isOnSale(pack, now),
        availableTo: pack.available_to,
      };
    })
    .filter((pack) => pack.stickerCount > 0);
}

/**
 * Arranges the shop. `answers` is the user's onboarding_answers row (or null); `query` filters every section
 * by pack name, sticker words and tags.
 */
export function buildShop(packRows: unknown[], stickerRows: unknown[], answers: unknown, now: Date, query = ''): Shop {
  const packs = buildPacks(packRows, stickerRows, now).filter((pack) => matchesQuery(pack, query));
  const parsed = answersRowSchema.safeParse(answers);
  const picked: ShopReason[] = parsed.success
    ? [
        ...parsed.data.whoamiwith.map((key) => ({ group: 'whoamiwith' as const, key })),
        ...parsed.data.mebusywith.map((key) => ({ group: 'mebusywith' as const, key })),
        ...(parsed.data.ootd === null ? [] : [{ group: 'ootd' as const, key: parsed.data.ootd }]),
      ]
    : [];
  const score = (pack: ShopPack) => picked.filter((r) => pack.tags.includes(toTag(r.key))).length;

  const seasonal = packs.find((p) => p.tier === 'seasonal' && p.onSale && !p.owned) ?? null;
  const forYou = packs
    .filter((p) => p.onSale && !p.owned && p !== seasonal)
    .map((pack, index) => ({ pack, index, score: score(pack) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((e) => e.pack);
  const reasons = picked.filter((r) => forYou.some((p) => p.tags.includes(toTag(r.key)))).slice(0, 2);
  const yours = packs.filter((p) => p.owned);
  return { seasonal, forYou, reasons, yours };
}
