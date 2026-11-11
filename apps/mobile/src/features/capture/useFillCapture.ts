// The camera's Fill this jar mode (FR-DAY-02): opened as `/camera?date=YYYY-MM-DD&slot=…` from My days.
// Null for a normal capture (no date, or one that isn't in the past), which keeps the open-jar path and
// the travel rule untouched.
import { useDayJar } from '@/features/days/useDayJar';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { formatShortDate } from '@/lib/format';
import type { Slot } from '@/theme/tokens';

import { fillTarget, parseFillDateParam, type FillTarget } from './fillTarget';

export type FillCapture = {
  target: FillTarget;
  /** Slots already held in that day's jar (server moments and queued photos): not selectable. */
  taken: ReadonlySet<Slot>;
  /** The day for the slot tag, e.g. "Sat, Nov 7". */
  dateLabel: string;
};

/** `rawDate` is the untrusted `?date=` param; `today` is today's date in the phone zone `phoneTz`. */
export function useFillCapture(rawDate: unknown, today: string, phoneTz: string): FillCapture | null {
  const date = parseFillDateParam(rawDate, today);
  const { day, queue } = useDayJar(date);
  if (date === null) return null;
  const taken = new Set<Slot>(
    buildTodayGrid({ localDate: date, moments: day?.moments ?? [], queue, nowSlot: null })
      .filter(holdsSlot)
      .map((tile) => tile.slot),
  );
  return {
    target: fillTarget(date, day?.jar, phoneTz),
    taken,
    dateLabel: formatShortDate(new Date(`${date}T00:00:00Z`), 'UTC'),
  };
}
