'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { waitlistEnv } from '~/lib/env';

export type WaitlistStatus = 'joined' | 'limited' | 'invalid' | 'error';

const input = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  source: z.enum(['hero', 'final', 'waitlist']).catch('hero'),
});

/** Sends the address to fn:waitlist-join with the shared secret and the visitor's IP (for its rate limit). */
async function join(form: FormData): Promise<WaitlistStatus> {
  const parsed = input.safeParse({ email: form.get('email'), source: form.get('source') });
  if (!parsed.success) return 'invalid';
  const config = waitlistEnv();
  if (!config) return 'error';
  const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0]?.trim().slice(0, 64) || 'unknown';
  try {
    const res = await fetch(`${config.SUPABASE_URL}/functions/v1/waitlist-join`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: config.SUPABASE_ANON_KEY,
        authorization: `Bearer ${config.SUPABASE_ANON_KEY}`,
        'x-waitlist-secret': config.WAITLIST_SECRET,
        'x-client-ip': ip,
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
    if (res.ok) return 'joined';
    if (res.status === 429) return 'limited';
    if (res.status === 400) return 'invalid';
    return 'error';
  } catch {
    return 'error';
  }
}

/** The waitlist forms' action; the answer is a page, so it works without JavaScript. */
export async function joinWaitlist(form: FormData): Promise<void> {
  redirect(`/waitlist?status=${await join(form)}`);
}
