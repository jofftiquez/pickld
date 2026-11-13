// Which tiles pop in on Today and the day page (D-58, D-77): a slot that fills while the page is in front, or
// that filled while it waited behind the camera, pops when the page is in front again. Nothing pops while the
// jar and queue load, nor for slots already filled then. Each slot pops once per date: an upload that leaves
// the queue a moment before its server moment arrives must not pop (and buzz) twice.
import { useEffect, useState } from 'react';

import { tapHaptic } from '@/lib/haptics';
import { useScreenFocused } from '@/lib/useScreenFocused';
import { slots, type Slot } from '@/theme/tokens';

import { holdsSlot, type GridTile } from './todayGrid';

type Seen = {
  date: string;
  /** Slots seen filled on this date. */
  filled: readonly Slot[];
  /** The newest fill's slots, popping until the next fill. */
  popping: readonly Slot[];
  /** Counts fills, for the haptic. */
  fills: number;
};

/**
 * The slots to pop: the newest fill, kept until the next one. A light haptic plays with each new fill.
 * `loadedDate` is the jar's date once its jar and the queue have loaded, null before. `skipFull`: the fill
 * that completes all 8 slots doesn't pop, because the Full jar celebration follows (Today); it still buzzes.
 */
export function useFillPops(
  tiles: readonly GridTile[],
  loadedDate: string | null,
  options: { skipFull?: boolean } = {},
): ReadonlySet<Slot> {
  const focused = useScreenFocused();
  const [seen, setSeen] = useState<Seen | null>(null);
  const filled = tiles.filter(holdsSlot).map((tile) => tile.slot);

  // Worked out while rendering (React’s “adjust state when a prop changes” pattern), so a new tile's first
  // frame already starts small.
  if (focused && loadedDate !== null) {
    if (seen === null || seen.date !== loadedDate) {
      // The first look at this date only records what is there.
      setSeen({ date: loadedDate, filled, popping: [], fills: seen?.fills ?? 0 });
    } else {
      const fresh = filled.filter((slot) => !seen.filled.includes(slot));
      if (fresh.length > 0) {
        const full = options.skipFull === true && filled.length === slots.length;
        setSeen({
          date: loadedDate,
          filled: [...seen.filled, ...fresh],
          popping: full ? seen.popping : fresh,
          fills: seen.fills + 1,
        });
      }
    }
  }

  const fills = seen?.fills ?? 0;
  useEffect(() => {
    if (fills > 0) tapHaptic();
  }, [fills]);
  return new Set(seen !== null && seen.date === loadedDate ? seen.popping : []);
}
