'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { DecisionInput, type DecisionResult, ERROR_CODES } from '~/lib/decide';
import { supabase } from '~/lib/supabase';

const Failure = z.object({ error: z.object({ code: z.string() }) });

/**
 * Keep, Remove, Remove and warn or Escalate one queue item. The decision goes through fn:mod-action with the
 * moderator's own session: Postgres checks the role, applies it, counts strikes and writes the audit row.
 */
export async function decide(input: DecisionInput): Promise<DecisionResult> {
  const parsed = DecisionInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'unknown' };
  const client = await supabase();
  const { error } = await client.functions.invoke('mod-action', { body: parsed.data });
  if (error) {
    const context: unknown = 'context' in error ? error.context : null;
    const body: unknown = context instanceof Response ? await context.json().catch(() => null) : null;
    const code = Failure.safeParse(body).data?.error.code;
    const known = ERROR_CODES.find((c) => c === code);
    return { ok: false, code: known ?? 'unknown' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
