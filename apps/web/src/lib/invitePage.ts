import { headers } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// Data for the invite page, pickld.me/i/<token> (INV-05, FR-WEB-04), from fn:invite (INV-04). The function asks
// Postgres whether the code or link works now and whose it is; it never returns a code, a count or a photo,
// and every reason an invite can't be used gets the same answer.

const TOKEN = /^([A-Za-z0-9]{6}|[A-Za-z0-9]{10})$/;

const answer = z.object({
  kind: z.enum(['personal', 'waitlist', 'admin']),
  inviter: z.object({ username: z.string(), display_name: z.string(), avatar: z.url().nullable() }).nullable(),
});
export type InviteInviter = NonNullable<z.infer<typeof answer>['inviter']>;

export type InvitePage =
  ({ state: 'ok'; token: string } & z.infer<typeof answer>) | { state: 'unavailable' | 'limited' };

/** The token as the app and fn:invite read it: no spaces or dashes, upper case. */
export function normalizeToken(raw: string): string | null {
  const token = decodeURIComponent(raw).replace(/[\s-]/g, '').toUpperCase();
  return TOKEN.test(token) ? token : null;
}

/**
 * fn:invite limits checks per visitor IP. Every request from this server shares one IP, so it passes the
 * visitor's with WAITLIST_SECRET, the secret fn:invite already trusts for that (before launch: take the IP
 * only from the edge's own header).
 */
async function forwardHeaders(): Promise<Record<string, string>> {
  const secret = process.env.WAITLIST_SECRET ?? '';
  const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  return secret.length >= 32 && ip ? { 'x-waitlist-secret': secret, 'x-client-ip': ip } : {};
}

/** Cached per request, so generateMetadata and the page share one check. */
export const getInvite = cache(async (raw: string): Promise<InvitePage> => {
  const token = normalizeToken(raw);
  if (!token) return { state: 'unavailable' };
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/invite`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(await forwardHeaders()),
    },
    body: JSON.stringify({ token }),
    cache: 'no-store', // an invite can be used up at any moment, and the avatar URL expires
  });
  if (res.status === 429) return { state: 'limited' };
  if (res.status === 404 || res.status === 400) return { state: 'unavailable' };
  if (!res.ok) throw new Error(`invite answered ${res.status}`);
  const data = answer.parse(((await res.json()) as { data: unknown }).data);
  return { state: 'ok', token, ...data };
});
