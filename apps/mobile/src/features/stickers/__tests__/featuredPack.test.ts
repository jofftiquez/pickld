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

  it('offers only paid packs on sale that the user doesn’t own, a different one each day in turn', () => {
    const picks = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].map((d) => featuredPack(packs, d)?.slug);
    // Three candidates (olivia, corporate, pride): consecutive days walk through all three and wrap around.
    expect(new Set(picks.slice(0, 3))).toEqual(new Set(['olivia', 'corporate', 'pride']));
    expect(picks[3]).toBe(picks[0]);
  });

  it('keeps the same pack all day, across a month and a year boundary too', () => {
    expect(featuredPack(packs, '2026-11-16')).toBe(featuredPack(packs, '2026-11-16'));
    const yearEnd = ['2026-12-31', '2027-01-01'].map((d) => featuredPack(packs, d)?.slug);
    expect(yearEnd[0]).not.toBe(yearEnd[1]);
  });

  it('is null once the user owns every pack on sale, which hides the tile', () => {
    expect(
      featuredPack(
        packs.map((p) => ({ ...p, owned: true })),
        '2026-11-16',
      ),
    ).toBeNull();
    expect(featuredPack([], '2026-11-16')).toBeNull();
  });
});
