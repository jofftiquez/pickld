// A photo shared from Photos for an earlier day (app/shared-photo.tsx; FR-DAY-02): that day's jar, the slots
// it already holds and its label. The camera no longer fills past days (D-153); a past day's own page fills
// it from the gallery with `fillTarget` and its tiles.
// Null for a photo from today (no date, or one that isn't in the past), which keeps the open-jar path and
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
  /** The day for the share sheet's line, e.g. "Sat, Nov 7". */
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
