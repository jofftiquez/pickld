import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// The Sticker Studio (FR-MOD-10). Moderators read every pack, drafts included (RLS, 0100); changes go through
// the mod_studio_* functions (0102) and art through fn:sticker-studio, both as the moderator's own session.

export const SLOTS = [
  'whereami',
  'mebusywith',
  'whoamiwith',
  'ootd',
  'selfie',
  'morning',
  'afternoon',
  'evening',
] as const;
export type Slot = (typeof SLOTS)[number];

/** Free packs are edited here; premium, earned and seasonal packs carry rules the Studio doesn't manage. */
export const EDITABLE_TIER = 'free';

const Sticker = z.object({
  id: z.string(),
  label: z.string(),
  asset_path: z.string(),
  tags: z.array(z.string()),
  slot_hint: z.enum(SLOTS).nullable(),
  sort: z.number(),
  retired_at: z.string().nullable(),
  art_width: z.number().nullable(),
  art_height: z.number().nullable(),
  art_version: z.number(),
});
export type Sticker = z.infer<typeof Sticker>;

const PackRow = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tier: z.string(),
  status: z.enum(['draft', 'published']),
  published_at: z.string().nullable(),
  description: z.string().nullable(),
  sort: z.number(),
});
export type Pack = z.infer<typeof PackRow>;
export type PackSummary = Pack & { live: number; retired: number };

/** Every pack, drafts first, then in catalog order, with how many stickers are live and retired. */
export async function loadPacks(client: SupabaseClient): Promise<PackSummary[]> {
  const { data, error } = await client
    .from('sticker_packs')
    .select('id, slug, name, tier, status, published_at, description, sort, stickers(retired_at)')
    .order('sort');
  if (error) throw new Error(error.message);
  const rows = z
    .array(PackRow.extend({ stickers: z.array(z.object({ retired_at: z.string().nullable() })) }))
    .parse(data);
  return rows
    .map(({ stickers, ...p }) => ({
      ...p,
      live: stickers.filter((s) => s.retired_at === null).length,
      retired: stickers.filter((s) => s.retired_at !== null).length,
    }))
    .sort((a, b) => Number(b.status === 'draft') - Number(a.status === 'draft'));
}

export async function loadPack(
  client: SupabaseClient,
  id: string,
): Promise<{ pack: Pack; stickers: Sticker[] } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await client
    .from('sticker_packs')
    .select(
      'id, slug, name, tier, status, published_at, description, sort, stickers(id, label, asset_path, tags, slot_hint, sort, retired_at, art_width, art_height, art_version)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = PackRow.extend({ stickers: z.array(Sticker) }).parse(data);
  const { stickers, ...pack } = row;
  return { pack, stickers: stickers.sort((a, b) => a.sort - b.sort) };
}

/**
 * The photo Worker's origin, from fn:photo-urls (`{ stickerArt: true }`): art is drawn from
 * `<origin>/<asset_path>?v=<art_version>`, as the app does (D-131). Null when the function can't be reached.
 */
export async function stickerArtBase(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.functions.invoke('photo-urls', { body: { stickerArt: true } });
  if (error) return null;
  return z.object({ data: z.object({ stickerArtBase: z.string() }) }).safeParse(data).data?.data.stickerArtBase ?? null;
}

export function artUrl(base: string, s: Pick<Sticker, 'asset_path' | 'art_version'>): string {
  return `${base}/${s.asset_path}?v=${s.art_version}`;
}

/** The sticker's name: the last part of its key, stickers/<slug>/<name>.png. */
export function stickerName(assetPath: string): string {
  return assetPath.replace(/^.*\//, '').replace(/\.png$/, '');
}

/** A key part from a file name: "Blue Heart (1).png" → "blue-heart-1". */
export function nameFromFile(fileName: string): string {
  return fileName
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export const KEY_PART = '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$';

export const PACK_RESULTS = ['created', 'saved', 'bad_slug', 'slug_taken', 'not_found', 'not_editable'] as const;
export const PUBLISH_RESULTS = [
  'published',
  'already_published',
  'empty',
  'missing_size',
  'not_found',
  'not_editable',
] as const;
export const STICKER_RESULTS = ['saved', 'retired', 'restored', 'unchanged', 'not_found', 'not_editable'] as const;
export const UPLOAD_RESULTS = [
  'added',
  'replaced',
  'not_png',
  'bad_size',
  'too_large',
  'invalid_input',
  'bad_name',
  'not_editable',
  'name_taken',
  'not_found',
  'not_moderator',
  'upload_failed',
] as const;

export type PackResult = (typeof PACK_RESULTS)[number] | 'invalid' | 'unknown';
export type PublishResult = (typeof PUBLISH_RESULTS)[number] | 'unknown';
export type StickerResult = (typeof STICKER_RESULTS)[number] | 'invalid' | 'unknown';
export type UploadResult = (typeof UPLOAD_RESULTS)[number] | 'unavailable' | 'unknown';
