// Runs the reminder plan and the push token on Today (FR-NOT-01, FR-NOT-02): on open (Today mounting and the
// app coming back to the foreground, which also catches a zone change), when a slot fills or empties, and
// when the reminder settings change. Nothing happens until notifications are allowed; the Permissions
// screen (M4-07) asks. Reminder settings come from reminder_settings over the defaults, and a break's end
// from notification_prefs.break_until (0180), both read as the user.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import { z } from 'zod';

import { phoneTimeZone } from '@/features/jar/useToday';
import type { DaySlot } from '@/lib/jars';
import { getSupabase } from '@/lib/supabase';

import { notificationsAllowed, registerPushToken } from './pushToken';
import { DAY_SLOTS, mergeSettings, parseLocalTime, planReminders, type ReminderSetting } from './reminderPlan';
import { expoReminderApi, syncReminders } from './syncReminders';

const settingRow = z.object({
  slot: z.enum(DAY_SLOTS),
  local_time: z.string(),
  enabled: z.boolean(),
});

export async function fetchReminderSettings(userId: string): Promise<ReminderSetting[]> {
  const { data, error } = await getSupabase()
    .from('reminder_settings')
    .select('slot, local_time, enabled')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const rows = z.array(settingRow).parse(data);
  return mergeSettings(
    rows.flatMap((r) => {
      const minutes = parseLocalTime(r.local_time);
      return minutes === null ? [] : [{ slot: r.slot, minutes, enabled: r.enabled }];
    }),
  );
}

/**
 * Take a break (0180): when the break ends, as the server's ISO time, or null when there is none. Kept as text, not
 * a Date: the query cache is saved to disk as JSON (NFR-OFF-03), so a Date would come back as a string after a
 * restart.
 */
export async function fetchBreakUntil(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('notification_prefs')
    .select('break_until')
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(error.message);
  const until = z.object({ break_until: z.string().nullable() }).parse(data).break_until;
  return until;
}

/** Both under ['reminders', userId], so invalidating that refreshes the plan's inputs together. */
export const reminderQueryKeys = {
  settings: (userId: string) => ['reminders', userId] as const,
  breakUntil: (userId: string) => ['reminders', userId, 'break'] as const,
};

/** `filled`: the day slots of today's jar that hold a photo (server or queued). */
export function useReminderSync(userId: string | null, filled: readonly DaySlot[]) {
  const { t } = useTranslation();
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const settings = useQuery({
    queryKey: reminderQueryKeys.settings(userId ?? ''),
    queryFn: () => fetchReminderSettings(userId ?? ''),
    enabled: userId !== null,
  });
  const breakUntil = useQuery({
    queryKey: reminderQueryKeys.breakUntil(userId ?? ''),
    queryFn: () => fetchBreakUntil(userId ?? ''),
    enabled: userId !== null,
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setOpenedAt(Date.now());
    });
    return () => sub.remove();
  }, []);

  // Push token once per open.
  useEffect(() => {
    if (userId === null) return;
    void registerPushToken(userId).catch(() => undefined);
  }, [userId, openedAt]);

  const filledKey = [...filled].sort().join(',');
  const settingsData = settings.data;
  // Waits for the break to load; if it can't be read, reminders are planned as if there were none.
  const breakMs = breakUntil.isError
    ? null
    : breakUntil.data === undefined
      ? undefined
      : breakUntil.data === null
        ? null
        : Date.parse(breakUntil.data);
  useEffect(() => {
    if (userId === null || settingsData === undefined || breakMs === undefined) return;
    let cancelled = false;
    void (async () => {
      if (!(await notificationsAllowed()) || cancelled) return;
      const plan = planReminders({
        settings: settingsData,
        tz: phoneTimeZone(),
        now: new Date(),
        filledToday: new Set(filledKey === '' ? [] : (filledKey.split(',') as DaySlot[])),
        breakUntil: breakMs === null ? null : new Date(breakMs),
      });
      await syncReminders(
        plan,
        (r) => ({
          title: t(`reminders.${r.slot}.${r.copy}.title`),
          body: t(`reminders.${r.slot}.${r.copy}.body`, { slot: t(`slots.${r.slot}`) }),
        }),
        expoReminderApi,
      );
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, settingsData, breakMs, filledKey, openedAt, t]);
}
