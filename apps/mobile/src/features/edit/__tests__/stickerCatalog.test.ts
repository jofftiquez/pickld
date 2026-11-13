import { readFileSync } from 'fs';
import { join } from 'path';

import { overlaySchema } from '../edits';
import { buildCatalog, stickerOverlay, suggestionsFor, toTag, type StickerCatalog } from '../stickers/catalog';
import { stickerArt, stickerArtFor } from '../stickers/stickerArt';
import { packIds, packRows, seededStickers, stickerRows } from './stickerRows';

// The Stickers tool's catalog (FR-STK-01..03) on the real 0012 rows: which packs and stickers can be
// added, and the "For #slot" ordering.

const noAnswers = null;
const labels = (stickers: { label: string }[]) => stickers.map((s) => s.label);
const allStickers = (catalog: StickerCatalog) => catalog.packs.flatMap((p) => p.stickers);

describe('bundled art', () => {
  it('has a PNG for every sticker 0012, 0029, 0032 and 0060 seed, and nothing else', () => {
    expect(seededStickers).toHaveLength(50);
    const assetsIn = (migration: string, from = 'insert into') =>
      [
        ...readFileSync(join(__dirname, '../../../../../../supabase/migrations', migration), 'utf8')
          .split(from)
          .slice(1)
          .join(from)
          .matchAll(/'(stickers\/[a-z0-9-]+\/[a-z0-9-]+\.png)'/g),
      ].map((m) => m[1] ?? '');
    const paid = assetsIn('0029_paid_packs.sql');
    expect(paid).toHaveLength(76);
    // 0032 retires word stickers by asset path first; its insert adds the picture stickers.
    const pictures = assetsIn('0032_picture_stickers.sql');
    expect(pictures).toHaveLength(64);
    // 0060 adds picture packs (Olivia, Fish Moods, more Pinoy Life) and word packs, stamps and milestones.
    const added = assetsIn('0060_sticker_packs.sql');
    expect(added).toHaveLength(109);
    const addedPictures = added.filter((a) => /^stickers\/(olivia|fish-moods|pinoy-life)\//.test(a));
    expect(addedPictures).toHaveLength(40);
    const words = [...seededStickers.map((s) => s.asset), ...paid, ...added.filter((a) => !addedPictures.includes(a))];
    expect(Object.keys(stickerArt).sort()).toEqual([...words, ...pictures, ...addedPictures].sort());
    // Word stickers are wide labels; picture stickers fit a near-square box.
    for (const asset of words) expect(stickerArt[asset]!.width).toBeGreaterThan(stickerArt[asset]!.height);
    for (const asset of [...pictures, ...addedPictures]) {
      const art = stickerArt[asset]!;
      expect(Math.max(art.width, art.height)).toBeLessThanOrEqual(360);
    }
  });

  it('looks art up by asset_path only', () => {
    expect(stickerArtFor('stickers/stamps/time.png')).toMatchObject({ width: 546, height: 240 });
    expect(stickerArtFor('stickers/christmas/parol.png')).toBeUndefined();
    expect(stickerArtFor('toString')).toBeUndefined();
  });
});

describe('buildCatalog', () => {
  it('lists the free packs in catalog order with their stickers in order; Milestones stays out until one is earned', () => {
    const catalog = buildCatalog(packRows(), stickerRows(), noAnswers);
    expect(catalog.packs.map((p) => p.name)).toEqual(['Everyday', 'The Eight', 'Stamps']);
    expect(catalog.packs.map((p) => p.stickers.length)).toEqual([15, 24, 6]);
    expect(labels(catalog.packs[0]?.stickers ?? []).slice(0, 3)).toEqual(['Kape muna', 'Real ako', 'Busy bee']);
    expect(catalog.packs[2]?.stickers.map((s) => s.stamp)).toEqual([
      'time',
      'date',
      'weekday',
      'jar_number',
      null,
      null,
    ]);
  });

  it('orders packs and stickers by their sort, whatever order the server returns them in', () => {
    const catalog = buildCatalog(packRows().reverse(), stickerRows().reverse(), noAnswers);
    expect(catalog.packs.map((p) => p.slug)).toEqual(['everyday', 'the-eight', 'stamps']);
    expect(catalog.packs[0]?.stickers[0]?.label).toBe('Kape muna');
  });

  it("never offers a locked pack's stickers, even where they match the slot, but lists the pack as locked", () => {
    const catalog = buildCatalog(packRows(), stickerRows(), noAnswers);
    expect(catalog.packs.some((p) => p.id === packIds.christmas)).toBe(false);
    expect(labels(allStickers(catalog))).not.toContain('Noche Buena');
    expect(labels(suggestionsFor(catalog, 'afternoon'))).not.toContain('Noche Buena');
    expect(catalog.locked).toEqual([
      {
        id: packIds.christmas,
        slug: 'christmas',
        name: 'Christmas',
        productId: 'me.pickld.pack.christmas',
        seasonal: false,
      },
    ]);

    // The pack's own lock wins even if its sticker rows disagree (e.g. read at different moments).
    const disagreeing = stickerRows().map((s) =>
      s.pack_id === packIds.christmas ? { ...s, sticker_usable: true } : s,
    );
    expect(labels(allStickers(buildCatalog(packRows(), disagreeing, null)))).not.toContain('Noche Buena');
  });

  it('lists a pack as locked only while it is on sale, and never once the user owns it', () => {
    const seasonal = (window: { available_from: string | null; available_to: string | null }) =>
      packRows().map((p) => (p.slug === 'christmas' ? { ...p, tier: 'seasonal', ...window } : p));
    const season = { available_from: '2026-09-01T00:00:00+08:00', available_to: '2027-01-01T00:00:00+08:00' };
    const at = (iso: string) => buildCatalog(seasonal(season), stickerRows(), null, new Date(iso)).locked;
    expect(at('2026-08-31T15:59:59Z')).toEqual([]); // 23:59:59 on Aug 31 in Manila
    expect(at('2026-08-31T16:00:00Z').map((p) => p.seasonal)).toEqual([true]);
    expect(at('2026-12-31T15:59:59Z')).toHaveLength(1);
    expect(at('2026-12-31T16:00:00Z')).toEqual([]); // the window's end is the first instant off sale

    const noProduct = packRows().map((p) => (p.slug === 'christmas' ? { ...p, store_product_id: null } : p));
    expect(buildCatalog(noProduct, stickerRows(), null).locked).toEqual([]);
    const owned = packRows().map((p) => (p.slug === 'christmas' ? { ...p, pack_usable: true } : p));
    expect(buildCatalog(owned, stickerRows(), null).locked).toEqual([]);
  });

  it('offers a milestone sticker only once its own milestone is earned, not just the pack', () => {
    const catalog = buildCatalog(
      packRows({ earned: ['first_full_jar'] }),
      stickerRows({ earned: ['first_full_jar'] }),
      null,
    );
    const milestones = catalog.packs.find((p) => p.slug === 'milestones');
    expect(labels(milestones?.stickers ?? [])).toEqual(['First full jar']);

    const more = buildCatalog(
      packRows({ earned: ['first_full_jar', 'jars_30'] }),
      stickerRows({ earned: ['first_full_jar', 'jars_30'] }),
      null,
    );
    expect(labels(more.packs.find((p) => p.slug === 'milestones')?.stickers ?? [])).toEqual([
      'First full jar',
      '30 jars',
    ]);
  });

  it('treats an unanswered usable flag as locked and drops rows that do not parse, keeping the rest', () => {
    const rows = stickerRows();
    const kape = rows.find((r) => r.label === 'Kape muna');
    const broken = [
      { ...rows.find((r) => r.label === 'Real ako'), sticker_usable: null },
      { ...rows.find((r) => r.label === 'Busy bee'), id: 'not-a-uuid' },
      { ...rows.find((r) => r.label === 'Sana all'), slot_hint: 'brunch' },
      null,
      kape,
    ];
    const catalog = buildCatalog([...packRows(), { slug: 'x' }], broken, 'not answers');
    expect(catalog.packs.map((p) => p.name)).toEqual(['Everyday']);
    expect(labels(allStickers(catalog))).toEqual(['Kape muna']);
    expect(catalog.interests).toEqual([]);
  });

  it('leaves out a sticker this app has no art for (a pack added on the server later)', () => {
    const extra = {
      ...stickerRows()[0],
      id: '00000000-0000-4000-8000-0000000000e1',
      asset_path: 'stickers/everyday/new.png',
    };
    const catalog = buildCatalog(packRows(), [...stickerRows(), extra], null);
    expect(catalog.packs[0]?.stickers).toHaveLength(15);
  });
});

describe('My stickers order (user_pack_prefs, FR-STK-08)', () => {
  const pref = (slug: string, sort: number, hidden = false) => ({ pack_id: packIds[slug], sort, hidden });

  it("follows the user's order, leaves out packs they turned off, and puts packs they haven't arranged last", () => {
    const catalog = buildCatalog(packRows(), stickerRows(), noAnswers, new Date(), [
      pref('stamps', 0),
      pref('the-eight', 1, true),
    ]);
    // Everyday has no row yet (new to the user), so it follows the arranged Stamps.
    expect(catalog.packs.map((p) => p.name)).toEqual(['Stamps', 'Everyday']);
    expect(labels(allStickers(catalog))).not.toContain(seededStickers.find((s) => s.pack === 'the-eight')?.label);
  });

  it('never lets a preference row show a pack the user may not use', () => {
    const catalog = buildCatalog(packRows(), stickerRows(), noAnswers, new Date(), [pref('christmas', 0)]);
    expect(catalog.packs.map((p) => p.name)).toEqual(['Everyday', 'The Eight', 'Stamps']);
    expect(catalog.locked.map((p) => p.slug)).toEqual(['christmas']);
  });
});

describe('suggestionsFor (the "For #slot" row, FR-STK-03)', () => {
  it('lists every addable sticker hinted for the slot, in catalog order', () => {
    const catalog = buildCatalog(packRows(), stickerRows(), noAnswers);
    expect(labels(suggestionsFor(catalog, 'afternoon'))).toEqual([
      'Lunch break',
      'Merienda time',
      'Afternoon slump',
      'Siesta?',
      'Halfway there',
    ]);
    expect(labels(suggestionsFor(catalog, 'whoamiwith'))).toEqual(['Kain tayo', 'Barkada', 'Family time', 'Just me']);
  });

  it('puts the stickers matching more onboarding answers first, keeping catalog order among equals', () => {
    const answers = { day_type: null, whoamiwith: ['Family'], mebusywith: ['Side hustle'], ootd: null };
    const catalog = buildCatalog(packRows(), stickerRows(), answers);
    expect(catalog.interests).toEqual(['family', 'side_hustle']);
    // Kain tayo and Family time carry "family"; Just me and Barkada don't.
    expect(labels(suggestionsFor(catalog, 'whoamiwith'))).toEqual(['Kain tayo', 'Family time', 'Barkada', 'Just me']);
    expect(labels(suggestionsFor(catalog, 'mebusywith'))).toEqual([
      'Side hustle',
      'Busy bee',
      'Deadline mode',
      'Aral muna',
    ]);
  });

  it('tunes by the day type and outfit answers too', () => {
    const catalog = buildCatalog(packRows(), stickerRows(), {
      day_type: 'early_bird',
      whoamiwith: [],
      mebusywith: [],
      ootd: 'Gym clothes',
    });
    expect(labels(suggestionsFor(catalog, 'morning'))[0]).toBe('Early bird');
    expect(catalog.interests).toEqual(['early_bird', 'gym_clothes']);
  });

  it('is empty for a slot with no hinted stickers', () => {
    const catalog = buildCatalog(
      packRows(),
      stickerRows().filter((s) => s.slot_hint !== 'ootd'),
      null,
    );
    expect(suggestionsFor(catalog, 'ootd')).toEqual([]);
  });
});

describe('toTag', () => {
  it.each([
    ['Side hustle', 'side_hustle'],
    ['  Mostly me ', 'mostly_me'],
    ['Depends on the mood', 'depends_on_the_mood'],
    ['early_bird', 'early_bird'],
  ])('%s → %s', (value, tag) => expect(toTag(value)).toBe(tag));
});

describe('stickerOverlay', () => {
  const catalog = buildCatalog(packRows(), stickerRows(), null);
  const find = (label: string) => allStickers(catalog).find((s) => s.label === label);

  it('puts the sticker upright at the centre and carries what drawing it needs', () => {
    const kape = find('Kape muna');
    if (!kape) throw new Error('missing');
    const overlay = stickerOverlay(kape, 'o1');
    expect(overlay).toEqual({
      id: 'o1',
      type: 'sticker',
      x: 0.5,
      y: 0.5,
      scale: 0.36,
      rotation: 0,
      stickerId: kape.id,
      asset: 'stickers/everyday/kape-muna.png',
      label: 'Kape muna',
    });
    expect(overlaySchema.parse(overlay)).toEqual(overlay);
  });

  it('keeps an auto stamp kind', () => {
    const time = find('Time');
    if (!time) throw new Error('missing');
    expect(stickerOverlay(time, 'o2')).toMatchObject({ stamp: 'time', asset: 'stickers/stamps/time.png' });
  });
});
