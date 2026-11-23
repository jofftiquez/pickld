// Settings data (M4-16; FR-SET-01, FR-NOT-04). Everything is read and written as the user, through RLS:
// reminder_settings (owner, all), notification_prefs (owner select and update; a row per user, 0014) and
// profiles.default_visibility, profiles.discoverable (0150) and profiles.is_private (0176) (owner update; read back through
// my_profile). Saves update the cache first so switches move at once, and
// roll back if the write fails. A reminder change invalidates ['reminders', userId], which Today's
// useReminderSync watches, so the phone's scheduled reminders follow (FR-NOT-01). Take a break
// (notification_prefs.break_until, 0180) invalidates it too: Today leaves out reminders before the break ends.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { toLocalTime } from '@/features/onboarding/dayPresets';
import { profileImages } from '@/features/profile/useProfile';
import { fetchReminderSettings, reminderQueryKeys } from '@/features/reminders/useReminderSync';
import type { ReminderSetting } from '@/features/reminders/reminderPlan';
import type { Visibility } from '@/features/publish/publishJar';
import { todayQueryKeys } from '@/features/jar/useToday';
import { addDays, localDateIn, localTimeToInstant, type DaySlot } from '@/lib/jars';
import { getSupabase } from '@/lib/supabase';

/** The push types a person can turn off (FR-NOT-04). Removal and appeal notices stay on: they are about safety. */
export const PUSH_TYPES = [
  'new_reader',
  'like',
  'comment',
  'reply',
  'full_jar',
  'friend_joined',
  'tag',
  'together',
] as const;
export type PushType = (typeof PUSH_TYPES)[number];

const prefsRow = z.object({
  new_reader: z.boolean(),
  like: z.boolean(),
  comment: z.boolean(),
  reply: z.boolean(),
  full_jar: z.boolean(),
  friend_joined: z.boolean(),
  tag: z.boolean(),
  together: z.boolean(),
  quiet_hours: z.boolean(),
  quiet_start: z.string(),
  quiet_end: z.string(),
  break_until: z.string().nullable(),
});
export type NotificationPrefs = z.infer<typeof prefsRow>;
export type PrefKey = PushType | 'quiet_hours';

/** Take a break lengths, in days: today, 3 days, a week, 2 weeks. */
export const BREAK_DAYS = [1, 3, 7, 14] as const;
export type BreakDays = (typeof BREAK_DAYS)[number];

/** A break of `days` days, today included, ends at the local midnight after its last day. */
export function breakEnds(days: BreakDays, now: Date, tz: string): Date {
  return localTimeToInstant(addDays(localDateIn(now, tz), days), 0, tz);
}

const accountRow = z.object({
  username: z.string(),
  display_name: z.string(),
  default_visibility: z.enum(['everyone', 'readers', 'close_friends', 'only_me']),
  discoverable: z.boolean(),
  is_private: z.boolean(),
  birthday: z.string(),
});

export type SettingsAccount = {
  username: string;
  displayName: string;
  defaultVisibility: Visibility;
  /** Show me in Discover and suggestions (0150). */
  discoverable: boolean;
  /** Private account (0176): readers need approval and posts reach approved readers only. */
  isPrivate: boolean;
  /** Under 18: kept out of Discover whatever `discoverable` says (in_discover, 0150), and approves every new
   * reader whatever `isPrivate` says (needs_reader_approval, 0176). */
  minor: boolean;
  avatar: string | null;
};

/** Whether someone born on `birthday` (YYYY-MM-DD) is under 18 on `today` (YYYY-MM-DD). */
export function isMinor(birthday: string, today: string): boolean {
  const adultOn = `${Number(birthday.slice(0, 4)) + 18}${birthday.slice(4)}`;
  return adultOn > today;
}

export const settingsQueryKeys = {
  account: (userId: string) => ['settings', 'account', userId] as const,
  prefs: (userId: string) => ['settings', 'prefs', userId] as const,
};

async function fetchAccount(userId: string): Promise<SettingsAccount> {
  // my_profile: the owner's full row; discoverable and birthday aren't readable from profiles by others.
  const { data, error } = await getSupabase()
    .rpc('my_profile')
    .select('username, display_name, default_visibility, discoverable, is_private, birthday')
    .single();
  if (error) throw new Error(error.message);
  const row = accountRow.parse(data);
  const images = await profileImages(userId);
  return {
    username: row.username,
    displayName: row.display_name,
    defaultVisibility: row.default_visibility,
    discoverable: row.discoverable,
    isPrivate: row.is_private,
    minor: isMinor(row.birthday, new Date().toISOString().slice(0, 10)),
    avatar: images.avatar,
  };
}

async function fetchPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await getSupabase()
    .from('notification_prefs')
    .select(
      'new_reader, like, comment, reply, full_jar, friend_joined, tag, together, quiet_hours, quiet_start, quiet_end, break_until',
    )
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(error.message);
  return prefsRow.parse(data);
}

/** Optimistic save: set the cache, write, and put the old value back if the write fails. */
function useOptimistic<T, V>(
  key: readonly unknown[],
  apply: (current: T, change: V) => T,
  write: (change: V) => Promise<void>,
  after?: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onMutate: async (change: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<T>(key);
      if (before !== undefined) queryClient.setQueryData<T>(key, apply(before, change));
      return { before };
    },
    onError: (_e, _change, ctx) => {
      if (ctx?.before !== undefined) queryClient.setQueryData(key, ctx.before);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      after?.();
    },
  });
}

export type ReminderChange = { slot: DaySlot; minutes?: number; enabled?: boolean };

/** The account's settings alone, sharing Settings' cache; off until `enabled` (Discover's guide tip asks
 * whether the account is under 18, FR-ONB-10). */
export function useAccountSettings(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: settingsQueryKeys.account(userId ?? ''),
    queryFn: () => fetchAccount(userId ?? ''),
    enabled: enabled && userId !== null,
  });
}

export function useSettings(userId: string) {
  const queryClient = useQueryClient();
  const account = useQuery({ queryKey: settingsQueryKeys.account(userId), queryFn: () => fetchAccount(userId) });
  const reminders = useQuery({
    queryKey: reminderQueryKeys.settings(userId),
    queryFn: () => fetchReminderSettings(userId),
  });
  const prefs = useQuery({ queryKey: settingsQueryKeys.prefs(userId), queryFn: () => fetchPrefs(userId) });

  const saveReminder = useOptimistic<ReminderSetting[], ReminderChange>(
    reminderQueryKeys.settings(userId),
    (list, c) =>
      list.map((r) =>
        r.slot === c.slot ? { ...r, minutes: c.minutes ?? r.minutes, enabled: c.enabled ?? r.enabled } : r,
      ),
    async (c) => {
      // The whole row, from the cache after the optimistic update, so a time and a switch never undo each other.
      const row = queryClient
        .getQueryData<ReminderSetting[]>(reminderQueryKeys.settings(userId))
        ?.find((r) => r.slot === c.slot);
      if (!row) throw new Error('reminder settings not loaded');
      const { error } = await getSupabase()
        .from('reminder_settings')
        .upsert({ user_id: userId, slot: c.slot, local_time: toLocalTime(row.minutes), enabled: row.enabled });
      if (error) throw new Error(error.message);
    },
  );

  const savePref = useOptimistic<NotificationPrefs, { key: PrefKey; value: boolean }>(
    settingsQueryKeys.prefs(userId),
    (p, c) => ({ ...p, [c.key]: c.value }),
    async (c) => {
      const { error } = await getSupabase()
        .from('notification_prefs')
        .update({ [c.key]: c.value } as Partial<Record<PrefKey, boolean>>)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
  );

  /** Take a break: when it ends (ISO), or null to end it now. */
  const saveBreak = useOptimistic<NotificationPrefs, string | null>(
    settingsQueryKeys.prefs(userId),
    (p, until) => ({ ...p, break_until: until }),
    async (until) => {
      const { error } = await getSupabase()
        .from('notification_prefs')
        .update({ break_until: until })
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    // Today's useReminderSync re-plans the phone's reminders from the new end.
    () => void queryClient.invalidateQueries({ queryKey: reminderQueryKeys.settings(userId) }),
  );

  const saveVisibility = useOptimistic<SettingsAccount, Visibility>(
    settingsQueryKeys.account(userId),
    (a, v) => ({ ...a, defaultVisibility: v }),
    async (v) => {
      const { error } = await getSupabase().from('profiles').update({ default_visibility: v }).eq('id', userId);
      if (error) throw new Error(error.message);
    },
    // Today and Publish read the default from fetchMe.
    () => void queryClient.invalidateQueries({ queryKey: todayQueryKeys.me(userId) }),
  );

  const saveDiscoverable = useOptimistic<SettingsAccount, boolean>(
    settingsQueryKeys.account(userId),
    (a, on) => ({ ...a, discoverable: on }),
    async (on) => {
      const { error } = await getSupabase().from('profiles').update({ discoverable: on }).eq('id', userId);
      if (error) throw new Error(error.message);
    },
  );

  // Turning Private off approves everyone waiting (0176), so the Readers list and profiles are read again.
  const savePrivate = useOptimistic<SettingsAccount, boolean>(
    settingsQueryKeys.account(userId),
    (a, on) => ({ ...a, isPrivate: on }),
    async (on) => {
      const { error } = await getSupabase().from('profiles').update({ is_private: on }).eq('id', userId);
      if (error) throw new Error(error.message);
    },
    () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['followList'] });
      void queryClient.invalidateQueries({ queryKey: ['readerRequests'] });
    },
  );

  return {
    account,
    reminders,
    prefs,
    saveReminder,
    savePref,
    saveBreak,
    saveVisibility,
    saveDiscoverable,
    savePrivate,
  };
}
