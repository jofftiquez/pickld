import { sizes, space } from '@/theme/tokens';

// The filter grid (editor feedback, QA round 6): every filter shown at once in rows of four, no
// sideways scrolling. Each thumbnail reserves room for its ring and the white gap inside it.

/** Space each thumbnail reserves around itself for its ring and the white gap inside it. */
export const FILTER_RING = sizes.filterRing + sizes.filterRingGap;
export const FILTER_COLUMNS = 4;
/** Layout gap between thumbnails in a row: 12 px between the photos, as designed. */
export const FILTER_GAP = space.md - 2 * FILTER_RING;

/** The thumbnail square for a panel `width` points wide (inside its padding), in half points. */
export function filterThumbSize(width: number): number {
  const cell = (width - (FILTER_COLUMNS - 1) * FILTER_GAP) / FILTER_COLUMNS;
  return Math.max(sizes.minTap, Math.floor((cell - 2 * FILTER_RING) * 2) / 2);
}
