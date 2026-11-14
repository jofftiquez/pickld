// The Invite page's data (INV-07; FR-INV-03): the caller's codes, link and state from my_invites() (0132).
import { z } from 'zod';

import { WEB_BASE_URL } from '@/lib/links';
import { slots, type Slot } from '@/theme/tokens';

const invitee = z.object({
  joined_at: z.string(),
  // Null when the friend left, was removed, or a block stands between you: shown as "Joined" only.
  profile: z
    .object({
      id: z.string(),
      username: z.string(),
      display_name: z.string(),
      avatar_path: z.string().nullable(),
    })
    .nullable(),
});

export const myInvitesRow = z.object({
  unlocked: z.boolean(),
  frozen: z.boolean(),
  link: z.object({ id: z.string(), enabled: z.boolean() }).nullable(),
  codes: z.array(
    z.object({
      code: z.string(),
      set_no: z.number().int(),
      slot: z.enum(slots),
      used: z.boolean(),
      invitee: invitee.nullable(),
    }),
  ),
});
export type MyInvitesRow = z.infer<typeof myInvitesRow>;

export type InviteCode = {
  code: string;
  setNo: number;
  slot: Slot;
  used: boolean;
  /** Set once the code was used. */
  invitee: { joinedAt: string; profile: InviteeProfile | null } | null;
};
export type InviteeProfile = { id: string; username: string; displayName: string; avatarPath: string | null };

/** What the Invite page shows: Locked (no live moment yet), Paused (frozen by moderators) or Open. */
export type InviteState = 'locked' | 'paused' | 'open';

export type Invites = {
  state: InviteState;
  link: { id: string; enabled: boolean } | null;
  codes: InviteCode[];
};

export function inviteState(row: Pick<MyInvitesRow, 'unlocked' | 'frozen'>): InviteState {
  if (row.frozen) return 'paused';
  return row.unlocked ? 'open' : 'locked';
}

/** Codes still to give, in set then moment order. */
export const available = (codes: readonly InviteCode[]) => codes.filter((c) => !c.used);
/** Codes friends used, in set then moment order. */
export const invited = (codes: readonly InviteCode[]) => codes.filter((c) => c.used);

/** Codes grouped by set, each set in moment order. */
export function bySet(codes: readonly InviteCode[]): { setNo: number; codes: InviteCode[] }[] {
  const sets = new Map<number, InviteCode[]>();
  for (const code of codes) sets.set(code.setNo, [...(sets.get(code.setNo) ?? []), code]);
  return [...sets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([setNo, list]) => ({
      setNo,
      codes: [...list].sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot)),
    }));
}

/** "Invite friends · 6 left" on Settings: unused codes, or nothing while invites are locked or paused. */
export function leftToGive(invites: Invites | undefined): number | undefined {
  if (!invites || invites.state !== 'open') return undefined;
  return available(invites.codes).length;
}

/** pickld.me/i/<code or link id>: the web page that gets the code into the app (INV-05). */
export function inviteUrl(token: string): string {
  return `${WEB_BASE_URL}/i/${encodeURIComponent(token)}`;
}

/** The URL without its scheme, as printed: "pickld.me/i/K7M2QX". */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '');
