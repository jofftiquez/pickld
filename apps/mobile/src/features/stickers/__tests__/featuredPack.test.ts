import { featuredPack } from '../featuredPack';
import type { ShopPack } from '../shop';

function pack(slug: string, over: Partial<ShopPack> = {}): ShopPack {
  return {
    id: slug,
    slug,
    name: slug,
    tier: 'premium',
    description: null,
    productId: `me.pickld.pack.${slug}`,
    stickerCount: 1,
    stickers: [{ asset: `stickers/${slug}/a.png`, label: 'A' }],
    labels: ['A'],
    tags: [],
    owned: false,
    onSale: true,
    availableTo: null,
    ...over,
  };
}

describe('featuredPack (Today’s sticker pack tile)', () => {
  const packs = [
    pack('everyday', { tier: 'free', productId: null, owned: true, onSale: false }),
    pack('olivia'),
    pack('fish-moods', { owned: true }),
    pack('corporate'),
    pack('christmas-2025', { tier: 'seasonal', onSale: false }),
    pack('pride'),
  ];

  const at = (date: string, hour: number) => featuredPack(packs, date, hour)?.slug;

  it('offers only paid packs on sale that the user doesn’t own, the next one every 4 hours', () => {
    // Three candidates (olivia, corporate, pride): the day's 4-hour windows walk through all three in turn.
    const day = [0, 4, 8, 12, 16, 20].map((h) => at('2026-11-16', h));
    expect(new Set(day.slice(0, 3))).toEqual(new Set(['olivia', 'corporate', 'pride']));
    expect(day.slice(3)).toEqual(day.slice(0, 3));
  });

  it('holds within a 4-hour window and changes on the hour it ends', () => {
    expect(at('2026-11-16', 4)).toBe(at('2026-11-16', 7));
    expect(at('2026-11-16', 7)).not.toBe(at('2026-11-16', 8));
    expect(at('2026-11-16', 23)).toBe(at('2026-11-16', 20));
  });

  it('starts each day on a different pack, so the same hour doesn’t always show the same one', () => {
    const noons = Array.from({ length: 14 }, (_, i) => at(`2026-11-${String(10 + i).padStart(2, '0')}`, 12));
    expect(new Set(noons).size).toBe(3);
    // Across a year boundary the date still parses and picks a candidate.
    expect(['olivia', 'corporate', 'pride']).toContain(at('2027-01-01', 0));
  });

  it('once the user owns every pack on sale, walks their own packs instead, marked mine', () => {
    const allOwned = packs.map((p) => ({ ...p, owned: true }));
    // Owned packs include the free one and one no longer on sale; a pack without stickers has nothing to show.
    allOwned.push(pack('empty', { owned: true, stickers: [] }));
    const day = [0, 4, 8, 12, 16, 20].map((h) => featuredPack(allOwned, '2026-11-16', h));
    expect(day.every((p) => p?.mine === true)).toBe(true);
    expect(new Set(day.map((p) => p?.slug))).toEqual(
      new Set(['everyday', 'olivia', 'fish-moods', 'corporate', 'christmas-2025', 'pride']),
    );
    // While something is left to buy, the tile is a shop pack, not mine.
    expect(featuredPack(packs, '2026-11-16', 12)?.mine).toBe(false);
  });

  it('is null only when there is nothing to buy and nothing owned', () => {
    expect(featuredPack([], '2026-11-16', 12)).toBeNull();
    expect(featuredPack([pack('olivia', { onSale: false })], '2026-11-16', 12)).toBeNull();
  });
});
