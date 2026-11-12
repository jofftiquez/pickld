// Hand-made sticker_packs and stickers rows shaped like the shop's Supabase reads (0012 launch packs and
// 0029 paid packs, cut down to what the shop arranges), with pack_usable answered for one user.

type Pack = {
  slug: string;
  name: string;
  tier: 'free' | 'premium' | 'earned' | 'seasonal';
  sort: number;
  product?: string;
  from?: string;
  to?: string;
  description?: string;
  stickers: { label: string; tags: string[] }[];
};

export const shopPacks: Pack[] = [
  {
    slug: 'everyday',
    name: 'Everyday',
    tier: 'free',
    sort: 1,
    stickers: [
      { label: 'Kape muna', tags: ['coffee'] },
      { label: 'Real ako', tags: [] },
      { label: 'Busy bee', tags: ['work'] },
      { label: 'Sana all', tags: [] },
    ],
  },
  {
    slug: 'milestones',
    name: 'Milestones',
    tier: 'earned',
    sort: 4,
    stickers: [{ label: 'First full jar', tags: [] }],
  },
  {
    slug: 'christmas-2026',
    name: 'Christmas pack',
    tier: 'seasonal',
    sort: 10,
    product: 'me.pickld.pack.christmas_2026',
    from: '2026-09-01T00:00:00+08:00',
    to: '2027-01-01T00:00:00+08:00',
    description: 'Simbang Gabi, Noche Buena, aguinaldo. For the longest Christmas season in the world.',
    stickers: [
      { label: 'Simbang Gabi', tags: ['christmas', 'family'] },
      { label: 'Noche Buena', tags: ['christmas', 'food'] },
      { label: 'Aguinaldo', tags: ['christmas'] },
    ],
  },
  {
    slug: 'pinoy-life',
    name: 'Pinoy Life',
    tier: 'premium',
    sort: 11,
    product: 'me.pickld.pack.pinoy_life',
    stickers: [
      { label: 'Traffic na naman', tags: ['commute'] },
      { label: 'Ulam check', tags: ['food'] },
    ],
  },
  {
    slug: 'barkada',
    name: 'Barkada',
    tier: 'premium',
    sort: 12,
    product: 'me.pickld.pack.barkada',
    stickers: [
      { label: 'Kain tayo', tags: ['barkada', 'food'] },
      { label: 'Libre mo?', tags: ['barkada'] },
    ],
  },
  {
    slug: 'work-from-wherever',
    name: 'Work From Wherever',
    tier: 'premium',
    sort: 13,
    product: 'me.pickld.pack.work_from_wherever',
    stickers: [
      { label: 'Camera off', tags: ['work'] },
      { label: 'Could be an email', tags: ['work', 'meetings'] },
    ],
  },
  {
    slug: 'pet-parent',
    name: 'Pet Parent',
    tier: 'premium',
    sort: 14,
    product: 'me.pickld.pack.pet_parent',
    stickers: [{ label: 'Pet tax', tags: ['pets'] }],
  },
];

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function shopPackRows(owned: string[] = ['everyday', 'milestones']) {
  return shopPacks.map((p, i) => ({
    id: id(i + 1),
    slug: p.slug,
    name: p.name,
    tier: p.tier,
    description: p.description ?? null,
    store_product_id: p.product ?? null,
    available_from: p.from ?? null,
    available_to: p.to ?? null,
    sort: p.sort,
    pack_usable: owned.includes(p.slug),
  }));
}

export function shopStickerRows() {
  return shopPacks.flatMap((p, i) =>
    p.stickers.map((s, j) => ({
      id: id(1000 + i * 100 + j),
      pack_id: id(i + 1),
      label: s.label,
      asset_path: `stickers/${p.slug}/${s.label.toLowerCase().replace(/[^a-z]+/g, '-')}.png`,
      tags: s.tags,
      slot_hint: null,
      stamp: null,
      milestone_key: null,
      sort: j + 1,
      sticker_usable: false,
    })),
  );
}

export const answers = (whoamiwith: string[], mebusywith: string[] = [], ootd: string | null = null) => ({
  day_type: null,
  whoamiwith,
  mebusywith,
  ootd,
});
