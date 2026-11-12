// Runs the reminder plan and the push token on Today (FR-NOT-01, FR-NOT-02): on open (Today mounting and the
// app coming back to the foreground, which also catches a zone change), when a slot fills or empties, and
// when the reminder settings change. Nothing happens until notifications are allowed; the Permissions
// screen (M4-07) asks. Reminder settings come from reminder_settings over the defaults, read as the user.
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

export const reminderQueryKeys = { settings: (userId: string) => ['reminders', userId] as const };

/** `filled`: the day slots of today's jar that hold a photo (server or queued). */
export function useReminderSync(userId: string | null, filled: readonly DaySlot[]) {
  const { t } = useTranslation();
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const settings = useQuery({
    queryKey: reminderQueryKeys.settings(userId ?? ''),
    queryFn: () => fetchReminderSettings(userId ?? ''),
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
  useEffect(() => {
    if (userId === null || settingsData === undefined) return;
    let cancelled = false;
    void (async () => {
      if (!(await notificationsAllowed()) || cancelled) return;
      const plan = planReminders({
        settings: settingsData,
        tz: phoneTimeZone(),
        now: new Date(),
        filledToday: new Set(filledKey === '' ? [] : (filledKey.split(',') as DaySlot[])),
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
  }, [userId, settingsData, filledKey, openedAt, t]);
}
