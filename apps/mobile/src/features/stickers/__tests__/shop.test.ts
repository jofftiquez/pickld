import { buildShop } from '../shop';
import { answers, shopPackRows, shopStickerRows } from './shopRows';

// The Sticker shop's arrangement (FR-STK-06; design: StickerShop) on hand-made rows.

const NOV = new Date('2026-11-12T03:00:00Z');
const slugs = (packs: { slug: string }[]) => packs.map((p) => p.slug);

describe('buildShop', () => {
  it('puts the seasonal pack in the banner, the other packs on sale in "For you", and owned packs in "Yours"', () => {
    const shop = buildShop(shopPackRows(), shopStickerRows(), null, NOV);
    expect(shop.seasonal?.slug).toBe('christmas-2026');
    expect(shop.seasonal?.stickers.map((s) => s.label)).toEqual(['Simbang Gabi', 'Noche Buena', 'Aguinaldo']);
    // No answers: catalog order.
    expect(slugs(shop.forYou)).toEqual(['pinoy-life', 'barkada', 'work-from-wherever', 'pet-parent']);
    expect(shop.reasons).toEqual([]);
    expect(slugs(shop.yours)).toEqual(['everyday', 'milestones']);
    expect(shop.yours.map((p) => [p.owned, p.tier])).toEqual([
      [true, 'free'],
      [true, 'earned'],
    ]);
  });

  it('leads "For you" with packs matching more onboarding answers, and names up to two of the answers', () => {
    // Pets matches one pack; Barkada and Work each match one. Pinoy Life matches nothing.
    const shop = buildShop(shopPackRows(), shopStickerRows(), answers(['barkada'], ['work', 'pets']), NOV);
    expect(slugs(shop.forYou)).toEqual(['barkada', 'work-from-wherever', 'pet-parent', 'pinoy-life']);
    expect(shop.reasons).toEqual([
      { group: 'whoamiwith', key: 'barkada' },
      { group: 'mebusywith', key: 'work' },
    ]);
  });

  it('names only answers that matched a pack on sale', () => {
    const shop = buildShop(shopPackRows(), shopStickerRows(), answers(['family'], ['side_hustle', 'pets']), NOV);
    // "family" only matches the seasonal pack, which is the banner, not "For you".
    expect(shop.reasons).toEqual([{ group: 'mebusywith', key: 'pets' }]);
    expect(slugs(shop.forYou)[0]).toBe('pet-parent');
  });

  it('moves a bought pack to "Yours" and keeps a seasonal pack there after its season', () => {
    const owned = ['everyday', 'christmas-2026', 'barkada'];
    const now = buildShop(shopPackRows(owned), shopStickerRows(), null, NOV);
    expect(now.seasonal).toBeNull();
    expect(slugs(now.forYou)).toEqual(['pinoy-life', 'work-from-wherever', 'pet-parent']);
    expect(slugs(now.yours)).toEqual(['everyday', 'christmas-2026', 'barkada']);

    const later = buildShop(shopPackRows(owned), shopStickerRows(), null, new Date('2027-02-01T00:00:00Z'));
    expect(slugs(later.yours)).toContain('christmas-2026');
  });

  it('drops the seasonal pack outside its sale window when the user does not own it', () => {
    const before = buildShop(shopPackRows(), shopStickerRows(), null, new Date('2026-08-31T15:59:59Z'));
    expect(before.seasonal).toBeNull();
    expect(slugs(before.forYou)).not.toContain('christmas-2026');
    const first = buildShop(shopPackRows(), shopStickerRows(), null, new Date('2026-08-31T16:00:00Z'));
    expect(first.seasonal?.slug).toBe('christmas-2026');
    const after = buildShop(shopPackRows(), shopStickerRows(), null, new Date('2026-12-31T16:00:00Z'));
    expect(after.seasonal).toBeNull();
  });

  it('searches pack names, sticker words and tags in every section, ignoring case and accents', () => {
    const rows = [shopPackRows(), shopStickerRows(), null, NOV] as const;
    const noche = buildShop(...rows, 'NOCHE');
    expect(noche.seasonal?.slug).toBe('christmas-2026');
    expect(noche.forYou).toEqual([]);
    expect(noche.yours).toEqual([]);

    expect(slugs(buildShop(...rows, '  email ').forYou)).toEqual(['work-from-wherever']);
    // Tags: "food" is on Noche Buena, Ulam check and Kain tayo.
    const food = buildShop(...rows, 'food');
    expect(food.seasonal?.slug).toBe('christmas-2026');
    expect(slugs(food.forYou)).toEqual(['pinoy-life', 'barkada']);
    expect(slugs(buildShop(...rows, 'kápe').yours)).toEqual(['everyday']);
    expect(buildShop(...rows, 'zzz')).toEqual({ seasonal: null, forYou: [], reasons: [], yours: [] });
  });

  it('never sells a paid pack without a store product, and drops packs and rows that do not parse', () => {
    const rows = shopPackRows().map((p) => (p.slug === 'pet-parent' ? { ...p, store_product_id: null } : p));
    const shop = buildShop([...rows, { slug: 'broken' }, null], [...shopStickerRows(), { id: 'x' }], 'nope', NOV);
    expect(slugs(shop.forYou)).not.toContain('pet-parent');
    expect(slugs(shop.forYou)).toEqual(['pinoy-life', 'barkada', 'work-from-wherever']);
  });
});
