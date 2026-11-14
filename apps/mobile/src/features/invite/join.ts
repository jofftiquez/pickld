// Joining with an invite (INV-06; FR-INV-01, FR-INV-02): the code or link a new person brought, kept on the
// phone from the moment it arrives (link, paste or scan) until About you uses it; what fn:invite says about
// it before sign-up; and invite_redeem() (0135) once the profile exists.
import Storage from 'expo-sqlite/kv-store';
import { z } from 'zod';
import { create } from 'zustand';

import { track } from '@/lib/analytics';
import { inviteTokenFromUrl, normalizeInviteToken } from '@/lib/links';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

const KEY = 'pendingInvite';

type PendingInviteState = {
  /** The kept token, or null. Undefined until read from the phone. */
  token: string | null | undefined;
  load: () => Promise<string | null>;
  keep: (token: string) => Promise<void>;
  clear: () => Promise<void>;
};

/**
 * The invite token waiting to be used. It lives on the phone (expo-sqlite/kv-store), so it survives the trip
 * out to Mail for the email code or to Apple and Google, and the app being closed before About you.
 */
export const usePendingInvite = create<PendingInviteState>()((set, get) => ({
  token: undefined,
  load: async () => {
    const current = get().token;
    if (current !== undefined) return current;
    const token = normalizeInviteToken((await Storage.getItem(KEY)) ?? '');
    set({ token });
    return token;
  },
  keep: async (token) => {
    set({ token });
    await Storage.setItem(KEY, token);
  },
  clear: async () => {
    set({ token: null });
    await Storage.removeItem(KEY);
  },
}));

/** A typed, pasted or scanned invite: a bare code or link id, or a pickld.me/i/… URL. Null if it isn't one. */
export function inviteTokenFrom(text: string): string | null {
  return normalizeInviteToken(text) ?? inviteTokenFromUrl(text);
}

// ---------------------------------------------------------------- before sign-up: fn:invite

const preview = z.object({
  kind: z.enum(['personal', 'waitlist', 'admin']),
  inviter: z.object({ username: z.string(), display_name: z.string(), avatar: z.string().nullable() }).nullable(),
});
export type InvitePreview =
  | {
      ok: true;
      kind: 'personal' | 'waitlist' | 'admin';
      inviter: { username: string; displayName: string; avatar: string | null } | null;
    }
  | { ok: false; reason: 'unavailable' | 'limited' };

/** What an invite is, without using it: whose it is, or that it can't be used. Throws when offline. */
export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const { data, error } = await getSupabase().functions.invoke<unknown>('invite', { body: { token } });
  if (error) {
    const status = (error as { context?: { status?: unknown } }).context?.status;
    if (status === 404) return { ok: false, reason: 'unavailable' };
    if (status === 429) return { ok: false, reason: 'limited' };
    throw error;
  }
  const body = preview.parse((data as { data?: unknown } | null)?.data);
  return {
    ok: true,
    kind: body.kind,
    inviter: body.inviter && {
      username: body.inviter.username,
      displayName: body.inviter.display_name,
      avatar: body.inviter.avatar,
    },
  };
}

// ---------------------------------------------------------------- after About you: invite_redeem()

const redeemed = z.discriminatedUnion('result', [
  z.object({
    result: z.literal('joined'),
    kind: z.enum(['personal', 'waitlist', 'admin']),
    inviter: z.string().nullable(),
  }),
  z.object({ result: z.enum(['unavailable', 'limited', 'already_member']) }),
]);
export type RedeemResult = z.infer<typeof redeemed>;

/** Uses the invite for the signed-in person: they're let in and, for a friend's code, read each other. */
export async function redeemInvite(token: string): Promise<RedeemResult> {
  const { data, error } = await getSupabase().rpc('invite_redeem', { p_token: token });
  if (error) throw new Error(error.message);
  const result = redeemed.parse(data);
  track(
    'invite_redeemed',
    result.result === 'joined' ? { kind: result.kind, outcome: 'joined' } : { outcome: result.result },
  );
  return result;
}

/** The toast once a code let you in: an adult reads a friend both ways, a teen only follows them (0135). */
export function announceJoined(inviter: string | null, adult: boolean): void {
  if (inviter) showToast(adult ? 'readEachOther' : 'following', { username: inviter });
  else showToast('joined');
}
