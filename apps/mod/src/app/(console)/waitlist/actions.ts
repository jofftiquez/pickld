'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { REMOVE_RESULTS, SEND_ERRORS, type RemoveResult, type SendResult } from '~/lib/waitlist';
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

const Count = z.coerce.number().int().min(1).max(500);
const Sent = z.object({ sent: z.number(), total: z.number() });

/**
 * Emails codes to the oldest people on the waitlist (INV-09) through the waitlist-send function, as the
 * moderator's own session: the function and Postgres let only founders do it, and each email goes out once.
 */
export async function sendCodes(_prev: SendResult | null, form: FormData): Promise<SendResult> {
  const count = Count.safeParse(form.get('count'));
  if (!count.success) return { result: 'invalid_input' };
  return send({ count: count.data, resendExpired: form.get('resendExpired') === 'on' });
}

const Picked = z.array(z.string().min(3).max(254)).min(1).max(100);

/**
 * Emails codes to the people ticked on the list, through the same waitlist-send function: Postgres gives a code
 * only to those who still need one, so ticking someone who was already sent a working code sends nothing.
 */
export async function sendPicked(_prev: SendResult | null, form: FormData): Promise<SendResult> {
  const emails = Picked.safeParse([...new Set(form.getAll('email'))]);
  if (!emails.success) return { result: 'invalid_input' };
  return send({ emails: emails.data });
}

async function send(body: { count: number; resendExpired: boolean } | { emails: string[] }): Promise<SendResult> {
  const { data, error } = await (await supabase()).functions.invoke('waitlist-send', { body });
  revalidatePath('/waitlist');
  if (!error) {
    const sent = Sent.safeParse((data as { data?: unknown } | null)?.data).data;
    return sent ? { result: 'sent', ...sent } : { result: 'unknown' };
  }
  // A refusal comes back as a non-2xx answer with { error: { code, details? } }.
  const context = (error as { context?: unknown }).context;
  const reply = context instanceof Response ? await context.json().catch(() => null) : null;
  const failed = z.object({ error: z.object({ code: z.literal('send_failed'), details: Sent }) }).safeParse(reply).data;
  if (failed) return { result: 'send_failed', ...failed.error.details };
  const code = z.object({ error: z.object({ code: z.enum(SEND_ERRORS) }) }).safeParse(reply).data?.error.code;
  return { result: code ?? 'unknown' };
}
