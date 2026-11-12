// Keeps the phone's scheduled reminders equal to the plan (FR-NOT-01): reminders no longer planned are
// cancelled (a slot just filled, a reminder turned off, a time moved), and every planned one is scheduled
// under its stable id, which replaces any earlier copy. Other local notifications are left alone.
import * as Notifications from 'expo-notifications';

import { REMINDER_ID_PREFIX, type PlannedReminder } from './reminderPlan';

export type ReminderContent = { title: string; body: string };

export type ReminderApi = {
  scheduledIds(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  schedule(id: string, content: ReminderContent & { data: Record<string, string> }, at: Date): Promise<void>;
};

export async function syncReminders(
  planned: readonly PlannedReminder[],
  contentOf: (reminder: PlannedReminder) => ReminderContent,
  api: ReminderApi,
): Promise<void> {
  const keep = new Set(planned.map((r) => r.id));
  const existing = (await api.scheduledIds()).filter((id) => id.startsWith(REMINDER_ID_PREFIX));
  for (const id of existing) if (!keep.has(id)) await api.cancel(id);
  for (const r of planned) {
    await api.schedule(
      r.id,
      { ...contentOf(r), data: { kind: 'reminder', slot: r.slot, localDate: r.localDate } },
      r.fireAt,
    );
  }
}

/** Cancels every scheduled reminder (sign-out). */
export async function cancelAllReminders(api: ReminderApi): Promise<void> {
  for (const id of await api.scheduledIds()) if (id.startsWith(REMINDER_ID_PREFIX)) await api.cancel(id);
}

export const expoReminderApi: ReminderApi = {
  scheduledIds: async () => (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier),
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
  schedule: async (identifier, { title, body, data }, date) => {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, data, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  },
};
