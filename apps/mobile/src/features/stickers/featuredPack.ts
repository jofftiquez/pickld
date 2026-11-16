import { useMemo } from 'react';

import { buildPacks, type ShopPack } from './shop';
import { useShopRows } from './useShop';

const DAY_MS = 86_400_000;

/** Today's pack tile changes every this many hours of the jar's local clock: 00:00, 04:00, 08:00, … */
export const FEATURED_PACK_HOURS = 4;

/** Days since 1970-01-01 for a local date like "2026-11-16"; 0 when the date doesn't parse. */
function dayNumber(localDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return 0;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/**
 * The sticker pack Today's 9th tile shows: a paid pack on sale that the user doesn't own. It changes every
 * `FEATURED_PACK_HOURS` hours of the jar's local clock, walking through the candidates in turn within a day;
 * each day starts from a different pack, so the same time of day doesn't always show the same one. Null
 * once the user owns every pack on sale, which hides the tile.
 */
export function featuredPack(packs: readonly ShopPack[], localDate: string, localHour: number): ShopPack | null {
  const pool = packs.filter((p) => p.onSale && !p.owned);
  if (pool.length === 0) return null;
  const window = Math.floor(localHour / FEATURED_PACK_HOURS);
  // A cheap integer hash of the day picks where the day's walk starts.
  const dayStart = Math.imul(dayNumber(localDate), 2654435761) >>> 0;
  return pool[(dayStart + window) % pool.length] ?? null;
}

/** Today's featured pack from the shop's cached rows; null while they load. */
export function useFeaturedPack(localDate: string, localHour: number): ShopPack | null {
  const rows = useShopRows();
  const window = Math.floor(localHour / FEATURED_PACK_HOURS);
  return useMemo(
    () =>
      rows.data
        ? featuredPack(
            buildPacks(rows.data.packs, rows.data.stickers, new Date()),
            localDate,
            window * FEATURED_PACK_HOURS,
          )
        : null,
    [rows.data, localDate, window],
  );
}
