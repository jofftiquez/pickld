// fn:waitlist-join (marketing site). The pickld.me "Join the waitlist" form posts to the web server, which
// calls this function with the shared WAITLIST_SECRET and the visitor's IP; nothing else may call it.
//   * The IP is stored only as HMAC-SHA256(WAITLIST_SECRET, ip), for waitlist_join()'s 5-an-hour limit (0071).
//   * The answer is the same for a new email and one already on the list, so the form can't tell anyone
//     who has joined.
//
// POST { email, source? }  (x-waitlist-secret: …, x-client-ip: …)
//   → { data: { joined: true } }
//   → { error: { code, message } }   400 invalid input, 401 wrong secret, 429 too many from this IP
import { z } from '../_shared/deps.ts';
import { fail, ok, readJson } from '../_shared/http.ts';

export const WaitlistInput = z.strictObject({
  email: z.string().trim().max(254).pipe(z.email()),
  source: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(),
});

export type JoinResult = 'joined' | 'already' | 'limited';

export interface WaitlistDeps {
  secret: () => string;
  join: (email: string, ipHash: string, source: string) => Promise<JoinResult>;
}

const encoder = new TextEncoder();

/** Same-length strings compared without an early exit. */
function sameSecret(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function ipHash(secret: string, ip: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`waitlist:${ip}`)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleWaitlistJoin(req: Request, deps: WaitlistDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const secret = deps.secret();
  if (secret.length < 32 || !sameSecret(req.headers.get('x-waitlist-secret') ?? '', secret)) {
    return fail(401, 'unauthorized', 'Not allowed.');
  }
  const ip = (req.headers.get('x-client-ip') ?? '').trim();
  if (!ip || ip.length > 64) return fail(400, 'invalid_input', 'The visitor IP is missing.');
  const body = await readJson(req);
  const parsed = WaitlistInput.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid_input', 'Send one email address.');

  const result = await deps.join(
    parsed.data.email.toLowerCase(),
    await ipHash(secret, ip),
    parsed.data.source ?? 'web',
  );
  if (result === 'limited') return fail(429, 'rate_limited', 'Too many sign-ups from here. Try again later.');
  return ok({ joined: true });
}
