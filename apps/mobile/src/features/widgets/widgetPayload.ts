// Home screen widget payloads (M6-09; FR-WID-01). The widgets run in their own runtime with no i18n or app
// state, so the app works out every string here and hands each widget finished props. Pure, so it's unit tested.
import type { Enums } from '@/lib/database.types';
import { addDays, currentSlot, localDateIn, localTimeToInstant } from '@/lib/jars';

type Slot = Enums<'slot'>;

export const SLOT_ORDER: readonly Slot[] = [
  'whereami',
  'mebusywith',
  'whoamiwith',
  'ootd',
  'selfie',
  'morning',
  'afternoon',
  'evening',
];
const TOTAL = SLOT_ORDER.length;
/** WidgetKit asks again when the timeline runs out; entries every 30 minutes keep "Next up" current. */
export const STEP_MINUTES = 30;

/** Props of the medium Today widget. */
export type TodayWidgetProps = {
  title: string;
  headline: string;
  subline: string;
  /** 0…1, how full the jar graphic is. */
  fill: number;
  url: string;
  captureUrl: string;
  captureLabel: string;
};

/**
 * Props of the small friend widget; `imageUri` is a file in the shared App Group folder, or '' for none (the
 * native side takes no nulls).
 */
export type FriendWidgetProps = {
  caption: string;
  imageUri: string;
  url: string;
};

export type WidgetStrings = {
  title: string;
  moments: (count: number, total: number) => string;
  nextUp: (slotTag: string) => string;
  full: string;
  captureLabel: string;
};

/**
 * What to fill next at an instant: the current time slot (morning, afternoon or evening) while it's empty,
 * otherwise the first empty slot in jar order; null when the jar is full.
 */
export function nextSlot(filled: ReadonlySet<Slot>, instant: Date, tz: string): Slot | null {
  const now = currentSlot(instant, tz);
  if (now !== null && !filled.has(now)) return now;
  return SLOT_ORDER.find((s) => !filled.has(s)) ?? null;
}

function todayProps(filled: ReadonlySet<Slot>, instant: Date, tz: string, s: WidgetStrings): TodayWidgetProps {
  const next = nextSlot(filled, instant, tz);
  return {
    title: s.title,
    headline: s.moments(filled.size, TOTAL),
    subline: next === null ? s.full : s.nextUp(`#${next}`),
    fill: filled.size / TOTAL,
    url: 'pickld://today',
    captureUrl: 'pickld://camera',
    captureLabel: s.captureLabel,
  };
}

/**
 * Timeline for the Today widget: an entry now and every 30 minutes until the jar's day ends, then an empty jar
 * at local midnight (a new jar starts then), and 30-minute entries a little into the new day.
 */
export function todayTimeline(
  filledSlots: readonly Slot[],
  now: Date,
  tz: string,
  strings: WidgetStrings,
): { date: Date; props: TodayWidgetProps }[] {
  const filled = new Set(filledSlots);
  const midnight = localTimeToInstant(addDays(localDateIn(now, tz), 1), 0, tz);
  const entries: { date: Date; props: TodayWidgetProps }[] = [];
  const step = STEP_MINUTES * 60_000;
  for (let t = now.getTime(); t < midnight.getTime(); t += step) {
    entries.push({ date: new Date(t), props: todayProps(filled, new Date(t), tz, strings) });
  }
  const empty = new Set<Slot>();
  for (let i = 0; i < 4; i++) {
    const at = new Date(midnight.getTime() + i * step);
    entries.push({ date: at, props: todayProps(empty, at, tz, strings) });
  }
  return entries;
}

/** The friend widget's caption, as in the design: "Mika · #whoamiwith". */
export function friendCaption(displayName: string, slot: Slot): string {
  const first = displayName.trim().split(/\s+/)[0] ?? displayName;
  return `${first} · #${slot}`;
}
