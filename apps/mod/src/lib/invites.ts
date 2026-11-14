import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// public.mod_invite_codes(), mod_invite_summary() and mod_user_invites() (0142). The invite tables have no
// client grants; these functions are the only way in, and they refuse non-moderators.
export const CODE_STATES = ['on', 'off', 'used_up', 'ended'] as const;

const Code = z.object({
  code: z.string(),
  note: z.string().nullable(),
  uses: z.number(),
  max_uses: z.number(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  state: z.enum(CODE_STATES),
  made_by: z.object({ username: z.string(), display_name: z.string(), founder: z.boolean() }).nullable(),
});
export type AdminCode = z.infer<typeof Code>;

const Summary = z.object({
  waiting: z.number(),
  joined_with_codes: z.number(),
  ends_at: z.string().nullable(),
});
export type InviteSummary = z.infer<typeof Summary>;

const UserInvites = z.object({
  has_codes: z.boolean(),
  unlocked: z.boolean(),
  frozen: z.object({ at: z.string(), note: z.string().nullable(), by: z.string().nullable() }).nullable(),
  link_enabled: z.boolean().nullable(),
  sets: z.number(),
  codes: z.number(),
  used: z.number(),
  invited_by: z
    .object({
      kind: z.enum(['personal', 'waitlist', 'admin']),
      code: z.string(),
      note: z.string().nullable(),
      via_link: z.boolean(),
      joined_at: z.string(),
      inviter: z.object({ id: z.uuid(), username: z.string() }).nullable(),
    })
    .nullable(),
  invitees: z.array(
    z.object({
      id: z.uuid().nullable(),
      username: z.string().nullable(),
      status: z.enum(['active', 'suspended', 'deleted', 'waiting']).nullable(),
      via_link: z.boolean(),
      joined_at: z.string(),
    }),
  ),
});
export type UserInviteInfo = z.infer<typeof UserInvites>;

export async function loadCodes(client: SupabaseClient): Promise<AdminCode[]> {
  const { data, error } = await client.rpc('mod_invite_codes');
  if (error) throw new Error(error.message);
  return z.array(Code).parse(data);
}

export async function loadInviteSummary(client: SupabaseClient): Promise<InviteSummary> {
  const { data, error } = await client.rpc('mod_invite_summary');
  if (error) throw new Error(error.message);
  return Summary.parse(data);
}

export async function loadUserInvites(client: SupabaseClient, id: string): Promise<UserInviteInfo | null> {
  const { data, error } = await client.rpc('mod_user_invites', { p_user: id });
  if (error) throw new Error(error.message);
  return UserInvites.nullable().parse(data);
}

/** The last moment of a picked day (YYYY-MM-DD) in Manila, where the console shows its dates. */
export function endOfDay(day: string): string {
  return `${day}T23:59:59+08:00`;
}

/** A date as the console shows days, e.g. "Feb 14", in Manila. */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

export type MakeCodeResult = { result: 'made'; code: string } | { result: 'note' | 'uses' | 'ends' | 'unknown' };
export type LetInResult = { result: 'done'; count: number } | { result: 'founders' | 'count' | 'unknown' };
export type GrantResult = { result: 'granted'; set_no: number } | { result: 'not_found' | 'unknown' };
export const FREEZE_RESULTS = [
  'frozen',
  'unfrozen',
  'already_frozen',
  'not_frozen',
  'own_account',
  'not_found',
] as const;
export type FreezeResult = (typeof FREEZE_RESULTS)[number] | 'note' | 'unknown';
