import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

// The launch catalog exactly as migration 0012 seeds it, shaped like the Stickers tool's Supabase reads
// (with the pack_usable and sticker_usable computed fields answered for a given user), so tests run on
// the real 50 stickers instead of a hand-made copy that could drift.

const MIGRATION = join(__dirname, '../../../../../../supabase/migrations/0012_sticker_catalog.sql');

const VALUE =
  /\('([a-z-]+)', (\d+),\s+'((?:[^']|'')*)',\s+'([^']+)',\s+'\{([^}]*)\}'(?:::text\[\])?,\s+(null|'[a-z_]+'),\s+(null|'[a-z_]+'),\s+(null|'[a-z_0-9]+')\)/g;

const unquote = (v: string) => (v === 'null' ? null : v.slice(1, -1));

/** md5(text)::uuid, as 0012 derives sticker ids. */
function md5Uuid(text: string): string {
  const h = createHash('md5').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const packIds: Record<string, string> = {
  everyday: '00000000-0000-4000-8000-000000000001',
  'the-eight': '00000000-0000-4000-8000-000000000002',
  stamps: '00000000-0000-4000-8000-000000000003',
  milestones: '00000000-0000-4000-8000-000000000004',
  christmas: '00000000-0000-4000-8000-000000000005',
};

/** 0001's launch packs, plus a premium pack on sale that the user doesn't own (a locked tab, FR-STK-06). */
const packs = [
  { slug: 'everyday', name: 'Everyday', tier: 'free', sort: 1 },
  { slug: 'the-eight', name: 'The Eight', tier: 'free', sort: 2 },
  { slug: 'stamps', name: 'Stamps', tier: 'free', sort: 3 },
  { slug: 'milestones', name: 'Milestones', tier: 'earned', sort: 4 },
  { slug: 'christmas', name: 'Christmas', tier: 'premium', sort: 5 },
];

export type StickerSeed = {
  pack: string;
  sort: number;
  label: string;
  asset: string;
  tags: string[];
  slotHint: string | null;
  stamp: string | null;
  milestoneKey: string | null;
  id: string;
};

export const seededStickers: StickerSeed[] = [...readFileSync(MIGRATION, 'utf8').matchAll(VALUE)].map((m) => ({
  pack: m[1] ?? '',
  sort: Number(m[2]),
  label: (m[3] ?? '').replace(/''/g, "'"),
  asset: m[4] ?? '',
  tags: (m[5] ?? '').split(','),
  slotHint: unquote(m[6] ?? 'null'),
  stamp: unquote(m[7] ?? 'null'),
  milestoneKey: unquote(m[8] ?? 'null'),
  id: md5Uuid(`pickld-sticker:${m[4] ?? ''}`),
}));

/** A premium sticker in the locked pack; it reuses bundled art so only the lock keeps it out. */
const lockedSticker: StickerSeed = {
  pack: 'christmas',
  sort: 1,
  label: 'Noche Buena',
  asset: 'stickers/everyday/salamat.png',
  tags: ['christmas'],
  slotHint: 'afternoon',
  stamp: null,
  milestoneKey: null,
  id: '00000000-0000-4000-8000-0000000000c1',
};

export type Viewer = { earned?: string[] };

/** sticker_packs rows as `select('id, slug, name, sort, tier, store_product_id, available_from, available_to, pack_usable')` returns them for this user. */
export function packRows({ earned = [] }: Viewer = {}) {
  return packs.map((p) => ({
    id: packIds[p.slug],
    slug: p.slug,
    name: p.name,
    sort: p.sort,
    tier: p.tier,
    store_product_id: p.tier === 'premium' ? 'me.pickld.pack.christmas' : null,
    available_from: null,
    available_to: null,
    // 0010 grants the Milestones pack with the first milestone; premium packs aren't owned here.
    pack_usable: p.tier === 'free' || (p.tier === 'earned' && earned.length > 0),
  }));
}

/** stickers rows with sticker_usable answered as 0012's sticker_usable() would. */
export function stickerRows(viewer: Viewer = {}) {
  const usable = new Map(packRows(viewer).map((p) => [p.id, p.pack_usable]));
  return [...seededStickers, lockedSticker].map((s) => ({
    id: s.id,
    pack_id: packIds[s.pack],
    label: s.label,
    asset_path: s.asset,
    tags: s.tags,
    slot_hint: s.slotHint,
    stamp: s.stamp,
    milestone_key: s.milestoneKey,
    sort: s.sort,
    sticker_usable:
      usable.get(packIds[s.pack] ?? '') === true &&
      (s.milestoneKey === null || (viewer.earned ?? []).includes(s.milestoneKey)),
  }));
}
