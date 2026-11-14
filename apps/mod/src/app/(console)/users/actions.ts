'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { FREEZE_RESULTS, type FreezeResult, type GrantResult } from '~/lib/invites';
import { SUSPEND_RESULTS, type SuspendResult } from '~/lib/users';
import { supabase } from '~/lib/supabase';

const Input = z.object({ user: z.uuid(), note: z.string().trim().min(1).max(500), lift: z.boolean() });
const Reply = z.object({ result: z.enum(SUSPEND_RESULTS) });

/**
 * Suspend for 7 days, or lift a suspension early (D-132), as the moderator's own session: Postgres checks the
 * role, refuses their own account and child-safety suspensions, and writes the audit row.
 */
export async function setSuspension(_prev: SuspendResult | null, form: FormData): Promise<SuspendResult> {
  const parsed = Input.safeParse({ user: form.get('user'), note: form.get('note'), lift: form.get('lift') === '1' });
  if (!parsed.success) return 'note';
  const { user, note, lift } = parsed.data;
  const client = await supabase();
  const { data, error } = await client.rpc(lift ? 'mod_lift_suspension' : 'mod_suspend', {
    p_user: user,
    p_note: note,
  });
  if (error) return 'unknown';
  const result = Reply.safeParse(data).data?.result ?? 'unknown';
  revalidatePath('/', 'layout');
  return result;
}

/** Gives the person another set of 8 personal codes (invite_grant_set, 0132; audit row in Postgres). */
export async function grantInviteSet(_prev: GrantResult | null, form: FormData): Promise<GrantResult> {
  const user = z.uuid().safeParse(form.get('user'));
  if (!user.success) return { result: 'unknown' };
  const { data, error } = await (await supabase()).rpc('invite_grant_set', { p_user: user.data });
  if (error) return { result: 'unknown' };
  const reply = z
    .union([
      z.object({ result: z.literal('granted'), set_no: z.number() }),
      z.object({ result: z.literal('not_found') }),
    ])
    .safeParse(data);
  revalidatePath(`/users/${user.data}`);
  return reply.success ? reply.data : { result: 'unknown' };
}

/** Pauses a person's invites or lets them work again, with a required note (invite_freeze/unfreeze, 0132). */
export async function setInviteFreeze(_prev: FreezeResult | null, form: FormData): Promise<FreezeResult> {
  const parsed = Input.safeParse({ user: form.get('user'), note: form.get('note'), lift: form.get('lift') === '1' });
  if (!parsed.success) return 'note';
  const { user, note, lift } = parsed.data;
  const { data, error } = await (
    await supabase()
  ).rpc(lift ? 'invite_unfreeze' : 'invite_freeze', { p_user: user, p_note: note });
  if (error) return 'unknown';
  revalidatePath(`/users/${user}`);
  return z.object({ result: z.enum(FREEZE_RESULTS) }).safeParse(data).data?.result ?? 'unknown';
}
