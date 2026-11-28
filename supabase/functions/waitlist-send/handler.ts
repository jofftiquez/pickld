// fn:waitlist-send (INV-09, FR-INV-04). The console's "Send codes" (the earliest N) and "Send code to selected" (the
// emails a founder ticked on the list) call this with the founder's own JWT. waitlist_release() (0143) picks the
// earliest people who still need a code, or waitlist_release_to() (0183) the ticked ones who still need one, and
// gives each one a code; this function emails them through Resend, 100 to a request, and after each request
// waitlist_mark_sent() records them and starts their codes' 14 days. If a request fails, the rest keep their codes
// unsent, and the next send hands the same codes out again. Each request carries an idempotency key made from its
// codes, so retrying a request Resend already took sends nothing twice.
//
// POST { count: 1–500, resendExpired?: boolean } | { emails: 1–100 }   (Authorization: Bearer <founder JWT>)
//   → { data: { sent, total } }   total: how many got a code; ticked emails that don't need one are left out
//   → { error: { code, message } }   400 invalid, 401 signed out, 403 not_founder, 405 method,
//                                    502 send_failed (details: { sent, total }), 503 email_not_configured
import { z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { inviteEmail } from './email.ts';

export const sendInput = z.union([
  z.strictObject({ count: z.number().int().min(1).max(500), resendExpired: z.boolean().optional() }),
  z.strictObject({ emails: z.array(z.string().trim().min(3).max(254)).min(1).max(100) }),
]);

export interface Released {
  email: string;
  code: string;
  expires_at: string;
}

export interface OutgoingEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export interface WaitlistSendDeps {
  /** Whether the JWT belongs to a founder (a moderator with app_metadata.founder = true); null when it's invalid. */
  isFounder: (jwt: string) => Promise<boolean | null>;
  release: (jwt: string, count: number, resendExpired: boolean) => Promise<Released[]>;
  releaseTo: (jwt: string, emails: string[]) => Promise<Released[]>;
  markSent: (jwt: string, emails: string[]) => Promise<number>;
  email: () => { apiKey: string; from: string } | null;
  site: () => string;
  /** Sends one batch; throws when the service refuses it. */
  send: (apiKey: string, emails: OutgoingEmail[], idempotencyKey: string) => Promise<void>;
}

export const BATCH = 100;

async function batchKey(codes: string[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode([...codes].sort().join(',')));
  return 'waitlist-' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** One request to Resend's batch endpoint (at most 100 emails). */
export async function sendWithResend(
  apiKey: string,
  emails: OutgoingEmail[],
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const res = await fetcher('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(emails),
  });
  if (!res.ok) throw new Error(`resend: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

export async function handleWaitlistSend(req: Request, deps: WaitlistSendDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const founder = await deps.isFounder(jwt);
  if (founder === null) return fail(401, 'unauthorized', 'Sign in first.');
  if (!founder) return fail(403, 'not_founder', 'Only founders can send waitlist codes.');

  const input = sendInput.safeParse(await readJson(req));
  if (!input.success) return fail(400, 'invalid_input', 'Send 1 to 500 codes, or 1 to 100 picked emails, at a time.');
  const config = deps.email();
  if (!config) return fail(503, 'email_not_configured', 'Email isn’t set up yet (RESEND_API_KEY and EMAIL_FROM).');

  const rows = 'emails' in input.data
    ? await deps.releaseTo(jwt, input.data.emails)
    : await deps.release(jwt, input.data.count, input.data.resendExpired ?? false);
  const site = deps.site();
  let sent = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const emails = chunk.map((r) => ({ from: config.from, to: [r.email], ...inviteEmail(r.code, r.expires_at, site) }));
    try {
      await deps.send(config.apiKey, emails, await batchKey(chunk.map((r) => r.code)));
    } catch (e) {
      console.error('waitlist-send: batch failed', e instanceof Error ? e.message : e);
      return fail(502, 'send_failed', `Sent ${sent} of ${rows.length}. The rest keep their codes for the next send.`, {
        sent,
        total: rows.length,
      });
    }
    sent += await deps.markSent(jwt, chunk.map((r) => r.email));
  }
  return ok({ sent, total: rows.length });
}
