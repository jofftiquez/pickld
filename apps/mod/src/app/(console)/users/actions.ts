'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

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
