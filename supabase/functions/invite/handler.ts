// fn:invite (INV-04; FR-INV-02, FR-WEB-04). The anonymous look at an invite code or link, for the
// pickld.me/i/<id> page and the code field at Sign up. Callers use the anon key; nothing here needs a session.
//   * Whether the token works, and whose it is, is decided in Postgres by invite_check() (0133), which never
//     uses the code and never says how many are left.
//   * 20 checks an hour per visitor IP. Postgres only sees HMAC-SHA256(key, "invite:" + ip). The IP is the
//     first x-forwarded-for entry; pickld.me's server, whose own IP every web visitor would share, passes the
//     visitor's IP as x-client-ip with the x-waitlist-secret header instead.
//   * A personal code or link names its owner, with a 15-minute avatar URL when they have one of their own.
//
// POST { token }   (a 6-character code or a 10-character link id; case and spaces don't matter)
//   → { data: { kind: 'personal', inviter: { username, display_name, avatar } } }
//   → { data: { kind: 'waitlist' | 'admin', inviter: null } }
//   → { error: { code, message } }   400 invalid input, 404 unavailable (every reason), 429 too many checks
import { z } from '../_shared/deps.ts';
import { fail, ok, readJson } from '../_shared/http.ts';
import { isProfileImageKey } from '../_shared/object_keys.ts';
import { signPhotoUrl } from '../_shared/photo_token.ts';
import { sameSecret } from '../waitlist-join/handler.ts';

export const AVATAR_TTL_SECONDS = 15 * 60;

export const InviteInput = z.strictObject({
  token: z.string().trim().regex(/^([A-Za-z0-9]{6}|[A-Za-z0-9]{10})$/),
});

export type CheckResult =
  | { result: 'unavailable' | 'limited' }
  | {
    result: 'ok';
    kind: 'personal' | 'waitlist' | 'admin';
    inviter: { id: string; username: string; display_name: string; avatar_path: string | null } | null;
  };

export interface InviteDeps {
  /** HMAC key for the IP hash. */
  hashKey: () => string;
  /** WAITLIST_SECRET when set: lets pickld.me's server pass the visitor's IP. */
  forwardSecret: () => string | null;
  check: (token: string, ipHash: string) => Promise<CheckResult>;
  photoBaseUrl: () => string;
  tokenSecret: () => string;
  now?: () => number; // unix seconds
}

const encoder = new TextEncoder();

export async function inviteIpHash(key: string, ip: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(`invite:${ip}`)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

function clientIp(req: Request, forwardSecret: string | null): string {
  if (
    forwardSecret && forwardSecret.length >= 32 && sameSecret(req.headers.get('x-waitlist-secret') ?? '', forwardSecret)
  ) {
    const ip = (req.headers.get('x-client-ip') ?? '').trim();
    if (ip) return ip;
  }
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
}

export async function handleInvite(req: Request, deps: InviteDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const ip = clientIp(req, deps.forwardSecret());
  if (!ip || ip.length > 64) return fail(400, 'invalid_input', 'The visitor IP is missing.');
  const body = await readJson(req);
  const parsed = InviteInput.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid_input', 'Send one invite code or link.');

  const answer = await deps.check(parsed.data.token.toUpperCase(), await inviteIpHash(deps.hashKey(), ip));
  if (answer.result === 'limited') return fail(429, 'rate_limited', 'Too many tries from here. Try again later.');
  if (answer.result !== 'ok') return fail(404, 'unavailable', 'This invite can’t be used.');
  if (!answer.inviter) return ok({ kind: answer.kind, inviter: null });

  const { id, username, display_name, avatar_path } = answer.inviter;
  const avatar = typeof avatar_path === 'string' && isProfileImageKey('avatar', avatar_path, id)
    ? (await signPhotoUrl(
      deps.photoBaseUrl(),
      avatar_path,
      deps.tokenSecret(),
      AVATAR_TTL_SECONDS,
      deps.now?.() ?? Math.floor(Date.now() / 1000),
    )).url
    : null;
  return ok({ kind: answer.kind, inviter: { username, display_name, avatar } });
}
