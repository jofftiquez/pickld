// Settings data (M4-16; FR-SET-01, FR-NOT-04). Everything is read and written as the user, through RLS:
// reminder_settings (owner, all), notification_prefs (owner select and update; a row per user, 0014) and
// profiles.default_visibility (owner update). Saves update the cache first so switches move at once, and
// roll back if the write fails. A reminder change invalidates ['reminders', userId], which Today's
// useReminderSync watches, so the phone's scheduled reminders follow (FR-NOT-01).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { toLocalTime } from '@/features/onboarding/dayPresets';
import { profileImages } from '@/features/profile/useProfile';
import { fetchReminderSettings, reminderQueryKeys } from '@/features/reminders/useReminderSync';
import type { ReminderSetting } from '@/features/reminders/reminderPlan';
import type { Visibility } from '@/features/publish/publishJar';
import { todayQueryKeys } from '@/features/jar/useToday';
import type { DaySlot } from '@/lib/jars';
import { getSupabase } from '@/lib/supabase';

/** The push types a person can turn off (FR-NOT-04). Removal and appeal notices stay on: they are about safety. */
export const PUSH_TYPES = ['new_reader', 'like', 'comment', 'reply', 'full_jar', 'friend_joined'] as const;
export type PushType = (typeof PUSH_TYPES)[number];

const prefsRow = z.object({
  new_reader: z.boolean(),
  like: z.boolean(),
  comment: z.boolean(),
  reply: z.boolean(),
  full_jar: z.boolean(),
  friend_joined: z.boolean(),
  quiet_hours: z.boolean(),
  quiet_start: z.string(),
  quiet_end: z.string(),
});
export type NotificationPrefs = z.infer<typeof prefsRow>;
export type PrefKey = PushType | 'quiet_hours';

const accountRow = z.object({
  username: z.string(),
  display_name: z.string(),
  default_visibility: z.enum(['everyone', 'readers', 'only_me']),
});

export type SettingsAccount = {
  username: string;
  displayName: string;
  defaultVisibility: Visibility;
  avatar: string | null;
};

export const settingsQueryKeys = {
  account: (userId: string) => ['settings', 'account', userId] as const,
  prefs: (userId: string) => ['settings', 'prefs', userId] as const,
};

async function fetchAccount(userId: string): Promise<SettingsAccount> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('username, display_name, default_visibility')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  const row = accountRow.parse(data);
  const images = await profileImages(userId);
  return {
    username: row.username,
    displayName: row.display_name,
    defaultVisibility: row.default_visibility,
    avatar: images.avatar,
  };
}

async function fetchPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await getSupabase()
    .from('notification_prefs')
    .select('new_reader, like, comment, reply, full_jar, friend_joined, quiet_hours, quiet_start, quiet_end')
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

  return { account, reminders, prefs, saveReminder, savePref, saveVisibility };
}
