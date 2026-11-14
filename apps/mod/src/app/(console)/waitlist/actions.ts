'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { REMOVE_RESULTS, type RemoveResult } from '~/lib/waitlist';
import { supabase } from '~/lib/supabase';

const Input = z.object({ email: z.string().trim().min(3).max(254), note: z.string().trim().min(1).max(500) });
const Reply = z.object({ result: z.enum(REMOVE_RESULTS) });

/**
 * Removes one email from the waitlist on that person's request (FR-MOD-08), as the moderator's own session:
 * Postgres checks the role, requires the note and writes an audit row without the email.
 */
export async function removeFromWaitlist(_prev: RemoveResult | null, form: FormData): Promise<RemoveResult> {
  const parsed = Input.safeParse({ email: form.get('email'), note: form.get('note') });
  if (!parsed.success) return 'note';
  const { data, error } = await (
    await supabase()
  ).rpc('mod_waitlist_remove', {
    p_email: parsed.data.email,
    p_note: parsed.data.note,
  });
  if (error) return 'unknown';
  const result = Reply.safeParse(data).data?.result ?? 'unknown';
  revalidatePath('/waitlist');
  return result;
}
