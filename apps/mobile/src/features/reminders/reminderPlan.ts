// Slot reminders (FR-NOT-01; design: LockScreen). Local notifications at each enabled slot time for the next
// 7 days, in the phone's current zone, so a trip moves them with the person. Today's reminder for a slot
// that is already filled (a server moment or one waiting in the offline queue) is left out, and so is any
// time already past. Copy rotates through a few gentle lines per slot and never mentions streaks. Pure.
import { addDays, localDateIn, localTimeToInstant, type DaySlot } from '@/lib/jars';

export const DAY_SLOTS = ['morning', 'afternoon', 'evening'] as const satisfies readonly DaySlot[];
export const REMINDER_DAYS = 7;
/** Copy variants per slot: `reminders.<slot>.<n>` in en.json. */
export const REMINDER_COPIES = [0, 1, 2, 3] as const;
export type ReminderCopy = (typeof REMINDER_COPIES)[number];

export type ReminderSetting = { slot: DaySlot; minutes: number; enabled: boolean };

/** Settings defaults (design: Settings): 7:00 AM, 1:00 PM and 7:30 PM, all on. */
export const DEFAULT_REMINDERS: readonly ReminderSetting[] = [
  { slot: 'morning', minutes: 7 * 60, enabled: true },
  { slot: 'afternoon', minutes: 13 * 60, enabled: true },
  { slot: 'evening', minutes: 19 * 60 + 30, enabled: true },
];

export type PlannedReminder = {
  /** Stable per date and slot, so rescheduling replaces instead of duplicating. */
  id: string;
  slot: DaySlot;
  localDate: string;
  fireAt: Date;
  /** Which of the slot's copy lines to use. */
  copy: ReminderCopy;
};

export const REMINDER_ID_PREFIX = 'pickld-reminder:';

/** "07:30:00" or "07:30" (Postgres `time`) → minutes after midnight; null when malformed. */
export function parseLocalTime(value: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** The saved settings over the defaults: a slot with no row keeps its default. */
export function mergeSettings(rows: readonly ReminderSetting[]): ReminderSetting[] {
  return DEFAULT_REMINDERS.map((d) => rows.find((r) => r.slot === d.slot) ?? d);
}

function dayNumber(localDate: string): number {
  return Math.floor(Date.parse(`${localDate}T00:00:00Z`) / 86_400_000);
}

export function planReminders(input: {
  settings: readonly ReminderSetting[];
  /** The phone's IANA zone now. */
  tz: string;
  now: Date;
  /** Day slots already filled in today's jar (server or queued). */
  filledToday: ReadonlySet<DaySlot>;
  days?: number;
}): PlannedReminder[] {
  const { settings, tz, now, filledToday, days = REMINDER_DAYS } = input;
  const today = localDateIn(now, tz);
  const planned: PlannedReminder[] = [];
  for (let d = 0; d < days; d += 1) {
    const localDate = addDays(today, d);
    for (const setting of settings) {
      if (!setting.enabled) continue;
      if (d === 0 && filledToday.has(setting.slot)) continue;
      const fireAt = localTimeToInstant(localDate, setting.minutes, tz);
      if (fireAt.getTime() <= now.getTime()) continue;
      planned.push({
        id: `${REMINDER_ID_PREFIX}${localDate}:${setting.slot}`,
        slot: setting.slot,
        localDate,
        fireAt,
        copy: REMINDER_COPIES[(dayNumber(localDate) + DAY_SLOTS.indexOf(setting.slot)) % REMINDER_COPIES.length] ?? 0,
      });
    }
  }
  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
