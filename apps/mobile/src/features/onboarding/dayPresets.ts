// Your day (FR-ONB-02): each day type sets the morning, afternoon and evening reminder times. Pure.
import type { ReminderSetting } from '@/features/reminders/reminderPlan';

export const DAY_TYPES = ['early_bird', 'coffee_first', 'night_owl'] as const;
export type DayType = (typeof DAY_TYPES)[number];
export type DayTimes = { morning: number; afternoon: number; evening: number };

const hm = (h: number, m = 0) => h * 60 + m;

/** Minutes after midnight, exactly as FR-ONB-02 lists them. */
export const DAY_PRESETS: Record<DayType, DayTimes> = {
  early_bird: { morning: hm(7), afternoon: hm(12, 30), evening: hm(19) },
  coffee_first: { morning: hm(8, 30), afternoon: hm(13), evening: hm(20) },
  night_owl: { morning: hm(10), afternoon: hm(15), evening: hm(21, 30) },
};

/** The slot windows (Now tile: 05:00–11:59, 12:00–17:59, 18:00–23:59), in 15-minute steps for Change. */
const WINDOWS: Record<keyof DayTimes, [number, number]> = {
  morning: [hm(5), hm(11, 45)],
  afternoon: [hm(12), hm(17, 45)],
  evening: [hm(18), hm(23, 45)],
};
export const TIME_STEP = 15;

export function timeOptions(slot: keyof DayTimes): number[] {
  const [from, to] = WINDOWS[slot];
  return Array.from({ length: (to - from) / TIME_STEP + 1 }, (_, i) => from + i * TIME_STEP);
}

/** "08:30" for Postgres `time`. */
export const toLocalTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function reminderSettings(times: DayTimes): ReminderSetting[] {
  return (['morning', 'afternoon', 'evening'] as const).map((slot) => ({ slot, minutes: times[slot], enabled: true }));
}
