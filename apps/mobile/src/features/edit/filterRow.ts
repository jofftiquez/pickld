import { sizes, space } from '@/theme/tokens';

// The filter row (design: Capture; QA item 23). It runs to the screen's right edge and scrolls; the
// thumbnail size is picked so the last thumbnail in view is cut in half, which shows there are more, the
// same hint as the sticker grid (item 15). The gap between thumbnails stays as designed.

/** Space each thumbnail reserves around itself for its ring and the white gap inside it. */
export const FILTER_RING = sizes.filterRing + sizes.filterRingGap;
/** Layout gap between thumbnails: 12 px between the photos, as designed. */
export const FILTER_GAP = space.md - 2 * FILTER_RING;
/** The row starts at the panel's padding. */
export const FILTER_LEAD = space.xl;

/**
 * The thumbnail square for a screen `width` points wide: closest to the designed size among the sizes that
 * show whole thumbnails followed by half of one.
 */
export function filterThumbSize(width: number): number {
  let best: number = sizes.filterThumb;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let whole = 2; whole <= 12; whole++) {
    // lead + whole × (thumb + 2 ring + gap) + (thumb + 2 ring) / 2 = width
    const thumb = (width - FILTER_LEAD - whole * (2 * FILTER_RING + FILTER_GAP) - FILTER_RING) / (whole + 0.5);
    if (thumb + 2 * FILTER_RING < sizes.minTap) break;
    const diff = Math.abs(thumb - sizes.filterThumb);
    if (diff < bestDiff) {
      best = thumb;
      bestDiff = diff;
    }
  }
  return Math.round(best * 2) / 2;
}
