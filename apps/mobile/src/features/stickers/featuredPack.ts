import { useMemo } from 'react';

import { buildPacks, type ShopPack } from './shop';
import { useShopRows } from './useShop';

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 for a local date like "2026-11-16"; 0 when the date doesn't parse. */
function dayNumber(localDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return 0;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/**
 * The sticker pack Today's 9th tile shows: a paid pack on sale that the user doesn't own, a different one
 * each day (by the jar's local date, so it holds all day and changes at midnight). Null once the user owns
 * every pack on sale, which hides the tile.
 */
export function featuredPack(packs: readonly ShopPack[], localDate: string): ShopPack | null {
  const pool = packs.filter((p) => p.onSale && !p.owned);
  if (pool.length === 0) return null;
  return pool[dayNumber(localDate) % pool.length] ?? null;
}

/** Today's featured pack from the shop's cached rows; null while they load. */
export function useFeaturedPack(localDate: string): ShopPack | null {
  const rows = useShopRows();
  return useMemo(
    () => (rows.data ? featuredPack(buildPacks(rows.data.packs, rows.data.stickers, new Date()), localDate) : null),
    [rows.data, localDate],
  );
}
