'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { endOfDay, type LetInResult, type MakeCodeResult } from '~/lib/invites';
import { supabase } from '~/lib/supabase';

const NewCode = z.object({
  note: z.string().trim().min(1).max(200),
  uses: z.coerce.number().int().min(1).max(10000),
  ends: z.union([z.literal(''), z.iso.date()]),
});

/** Makes an admin code as the moderator's own session; Postgres checks the role and writes the audit row. */
export async function makeCode(_prev: MakeCodeResult | null, form: FormData): Promise<MakeCodeResult> {
  const parsed = NewCode.safeParse({ note: form.get('note'), uses: form.get('uses'), ends: form.get('ends') ?? '' });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { result: field === 'uses' ? 'uses' : field === 'ends' ? 'ends' : 'note' };
  }
  const { note, uses, ends } = parsed.data;
  const until = ends ? endOfDay(ends) : null;
  if (until && new Date(until).getTime() <= Date.now()) return { result: 'ends' };
  const { data, error } = await (
    await supabase()
  ).rpc('mod_invite_code_create', { p_note: note, p_uses: uses, p_ends_at: until });
  const made = z.object({ result: z.literal('made'), code: z.string() }).safeParse(data);
  if (error || !made.success) return { result: 'unknown' };
  revalidatePath('/invites');
  return made.data;
}

/** Switches an admin code off or back on (audit row in Postgres). */
export async function switchCode(form: FormData): Promise<void> {
  const parsed = z
    .object({ code: z.string().regex(/^[A-Z0-9]{6}$/), enabled: z.enum(['0', '1']) })
    .safeParse({ code: form.get('code'), enabled: form.get('enabled') });
  if (!parsed.success) return;
  await (
    await supabase()
  ).rpc('mod_invite_code_set', { p_code: parsed.data.code, p_enabled: parsed.data.enabled === '1' });
  revalidatePath('/invites');
}

/** Founders only: lets the oldest N waiting accounts in. Postgres refuses everyone else (admit_waiting, 0131). */
export async function letIn(_prev: LetInResult | null, form: FormData): Promise<LetInResult> {
  const count = z.coerce.number().int().min(1).max(1000).safeParse(form.get('count'));
  if (!count.success) return { result: 'count' };
  const { data, error } = await (await supabase()).rpc('admit_waiting', { p_count: count.data });
  if (error) return { result: error.code === '42501' ? 'founders' : 'unknown' };
  revalidatePath('/', 'layout');
  return { result: 'done', count: z.number().catch(0).parse(data) };
}
