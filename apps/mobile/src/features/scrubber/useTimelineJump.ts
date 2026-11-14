import { useState } from 'react';

import { anchorFor, type TimelineScrubber } from './scrubberModel';
import { useFeedDays, type TimelineKind } from './useFeedDays';

/**
 * A timeline screen's side of the date scrubber (FR-SOC-01): the rail's days, and the day the reader jumped to.
 * Pass `from` to the feed hook and `viewKey` as the view's key, so every jump starts a fresh list at the top of
 * that day (or of the newest row, for the newest day). `clearJump` goes back to the newest row.
 */
export function useTimelineJump(kind: TimelineKind) {
  const { days, tz, refetch } = useFeedDays(kind);
  const [jump, setJump] = useState<{ day: string; from: string } | null>(null);
  const [jumps, setJumps] = useState(0);
  const scrubber: TimelineScrubber = {
    days,
    timeZone: tz,
    anchorDay: jump?.day ?? null,
    onJump: (day) => {
      setJump(day === days?.[0]?.day ? null : { day, from: anchorFor(day, tz) });
      setJumps((n) => n + 1);
    },
  };
  return {
    from: jump?.from,
    viewKey: `${jump?.from ?? 'newest'}:${jumps}`,
    scrubber,
    jumped: jump !== null,
    clearJump: () => setJump(null),
    refetchDays: refetch,
  };
}
