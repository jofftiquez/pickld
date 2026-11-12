import { z } from 'zod';

import { orderPacks, packRowSchema, parsePackPrefs, stickerRowSchema } from '@/features/edit/stickers/catalog';

// My stickers (FR-STK-08; design: MyStickers): every pack the user may use, in their order, with a switch to
// hide it from the Stickers tool. Ownership is the server's (pack_usable, owned_packs); the order and the
// switches are the user's own rows in user_pack_prefs.

const ownedRowSchema = z.object({
  pack_id: z.string(),
  source: z.string(),
  acquired_at: z.string(),
});

export type MyPack = {
  id: string;
  slug: string;
  name: string;
  /** How the user has it: free for everyone, bought (with when), or earned (with how many stickers so far). */
  kind: 'free' | 'bought' | 'earned';
  boughtAt: string | null;
  stickerCount: number;
  /** Stickers the user may add; below stickerCount for an earned pack still being filled. */
  usableCount: number;
  /** The first sticker, drawn on the pack's tile. */
  sample: { asset: string; label: string } | null;
  hidden: boolean;
};

function parseAll<T>(schema: z.ZodType<T>, rows: unknown[]): T[] {
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The packs My stickers lists, in the user's order (orderPacks) after catalog order. */
export function buildMyPacks(
  packRows: unknown[],
  stickerRows: unknown[],
  ownedRows: unknown[],
  prefRows: unknown[],
): MyPack[] {
  const prefs = parsePackPrefs(prefRows);
  const owned = new Map(parseAll(ownedRowSchema, ownedRows).map((row) => [row.pack_id, row]));
  const stickers = parseAll(stickerRowSchema, stickerRows);
  const packs = parseAll(packRowSchema, packRows)
    .filter((pack) => pack.pack_usable === true)
    .sort((a, b) => a.sort - b.sort)
    .map((pack): MyPack => {
      const own = stickers.filter((s) => s.pack_id === pack.id).sort((a, b) => a.sort - b.sort);
      const row = owned.get(pack.id);
      const kind = pack.tier === 'earned' ? 'earned' : row?.source === 'purchase' ? 'bought' : 'free';
      const first = own[0];
      return {
        id: pack.id,
        slug: pack.slug,
        name: pack.name,
        kind,
        boughtAt: kind === 'bought' ? (row?.acquired_at ?? null) : null,
        stickerCount: own.length,
        usableCount: own.filter((s) => s.sticker_usable === true).length,
        sample: first ? { asset: first.asset_path, label: first.label } : null,
        hidden: prefs.get(pack.id)?.hidden === true,
      };
    })
    .filter((pack) => pack.stickerCount > 0);
  return orderPacks(packs, prefs);
}

/** `list` with the pack at `from` moved to `to` (both clamped to the list). */
export function movePack<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const clampedTo = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  if (item === undefined) return [...list];
  next.splice(clampedTo, 0, item);
  return next;
}

/** The user_pack_prefs rows that save this order and these switches (positions 0, 1, 2, …). */
export function prefRowsFor(userId: string, packs: readonly MyPack[]) {
  return packs.map((pack, index) => ({ user_id: userId, pack_id: pack.id, sort: index, hidden: pack.hidden }));
}
