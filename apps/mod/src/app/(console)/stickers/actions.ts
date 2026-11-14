'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  KEY_PART,
  PACK_RESULTS,
  type PackResult,
  PUBLISH_RESULTS,
  type PublishResult,
  SLOTS,
  STICKER_RESULTS,
  type StickerResult,
  UPLOAD_RESULTS,
  type UploadResult,
} from '~/lib/stickers';
import { supabase } from '~/lib/supabase';

// Every change runs as the moderator's own session: Postgres checks the role, keeps the catalog rules (0100)
// and writes the audit row (0102). Art goes through fn:sticker-studio, which stores it server-side.

const keyPart = (max: number) => z.string().trim().max(max).regex(new RegExp(KEY_PART));
const text = (max: number) => z.string().trim().min(1).max(max);
const description = z.string().trim().max(200);

const CreateInput = z.object({ slug: keyPart(40), name: text(40), description });
const EditPackInput = z.object({ pack: z.uuid(), name: text(40), description });
const StickerInput = z.object({
  sticker: z.uuid(),
  label: text(40),
  tags: z.string().max(400),
  slot: z.enum(SLOTS).or(z.literal('')),
});

const resultOf = <T extends readonly string[]>(values: T, data: unknown): T[number] | 'unknown' =>
  z.object({ result: z.enum(values) }).safeParse(data).data?.result ?? 'unknown';

export async function createPack(_prev: PackResult | null, form: FormData): Promise<PackResult> {
  const parsed = CreateInput.safeParse({
    slug: form.get('slug'),
    name: form.get('name'),
    description: form.get('description') ?? '',
  });
  if (!parsed.success) return 'invalid';
  const client = await supabase();
  const { data, error } = await client.rpc('mod_studio_create_pack', {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
  });
  if (error) return 'unknown';
  const result = resultOf(PACK_RESULTS, data);
  if (result !== 'created') return result;
  const id = z.object({ id: z.uuid() }).parse(data).id;
  revalidatePath('/stickers');
  redirect(`/stickers/${id}`);
}

export async function editPack(_prev: PackResult | null, form: FormData): Promise<PackResult> {
  const parsed = EditPackInput.safeParse({
    pack: form.get('pack'),
    name: form.get('name'),
    description: form.get('description') ?? '',
  });
  if (!parsed.success) return 'invalid';
  const client = await supabase();
  const { data, error } = await client.rpc('mod_studio_edit_pack', {
    p_pack: parsed.data.pack,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
  });
  if (error) return 'unknown';
  revalidatePath('/stickers', 'layout');
  return resultOf(PACK_RESULTS, data);
}

export async function publishPack(_prev: PublishResult | null, form: FormData): Promise<PublishResult> {
  const pack = z.uuid().safeParse(form.get('pack'));
  if (!pack.success) return 'unknown';
  const client = await supabase();
  const { data, error } = await client.rpc('mod_studio_publish', { p_pack: pack.data });
  if (error) return 'unknown';
  revalidatePath('/stickers', 'layout');
  return resultOf(PUBLISH_RESULTS, data);
}

export async function editSticker(_prev: StickerResult | null, form: FormData): Promise<StickerResult> {
  const parsed = StickerInput.safeParse({
    sticker: form.get('sticker'),
    label: form.get('label'),
    tags: form.get('tags') ?? '',
    slot: form.get('slot') ?? '',
  });
  if (!parsed.success) return 'invalid';
  const tags = parsed.data.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length > 12 || tags.some((t) => t.length > 24)) return 'invalid';
  const client = await supabase();
  const { data, error } = await client.rpc('mod_studio_edit_sticker', {
    p_sticker: parsed.data.sticker,
    p_label: parsed.data.label,
    p_tags: tags,
    p_slot_hint: parsed.data.slot || null,
  });
  if (error) return 'unknown';
  revalidatePath('/stickers', 'layout');
  return resultOf(STICKER_RESULTS, data);
}

export async function setRetired(_prev: StickerResult | null, form: FormData): Promise<StickerResult> {
  const sticker = z.uuid().safeParse(form.get('sticker'));
  if (!sticker.success) return 'invalid';
  const client = await supabase();
  const { data, error } = await client.rpc('mod_studio_set_retired', {
    p_sticker: sticker.data,
    p_retired: form.get('retired') === '1',
  });
  if (error) return 'unknown';
  revalidatePath('/stickers', 'layout');
  return resultOf(STICKER_RESULTS, data);
}

export async function uploadArt(_prev: UploadResult | null, form: FormData): Promise<UploadResult> {
  const result = await sendArt(form);
  revalidatePath('/stickers', 'layout');
  return result;
}

/** One file of a bulk drop (BulkUpload): the page refreshes once when the whole drop is done, not per file. */
export async function uploadArtBulk(form: FormData): Promise<UploadResult> {
  return sendArt(form);
}

async function sendArt(form: FormData): Promise<UploadResult> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return 'invalid_input';
  const body = new FormData();
  for (const field of ['pack', 'name', 'label'] as const) {
    const v = form.get(field);
    if (typeof v === 'string' && v.trim() !== '') body.set(field, v.trim());
  }
  body.set('file', file, 'art.png');
  const client = await supabase();
  const { data, error } = await client.functions.invoke('sticker-studio', { body });
  if (!error) return resultOf(UPLOAD_RESULTS, (data as { data?: unknown } | null)?.data);
  // A refusal comes back as a non-2xx answer with { error: { code } }.
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    const reply = await context.json().catch(() => null);
    const code = z.object({ error: z.object({ code: z.enum(UPLOAD_RESULTS) }) }).safeParse(reply).data?.error.code;
    return code ?? 'unknown';
  }
  return 'unavailable';
}
