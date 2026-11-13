import { sizes } from '@/theme/tokens';

import { FILTER_GAP, FILTER_LEAD, FILTER_RING, filterThumbSize } from '../filterRow';

// QA item 23: with eleven filters the row scrolls, and the last thumbnail in view is cut in half.

describe('filterThumbSize', () => {
  it.each([375, 390, 393, 402, 430, 440])('on a %i pt wide screen ends the view on half a thumbnail', (width) => {
    const thumb = filterThumbSize(width);
    const step = thumb + 2 * FILTER_RING + FILTER_GAP;
    const cell = thumb + 2 * FILTER_RING;
    // What's left after the lead and the whole thumbnails is about half a thumbnail (within rounding).
    const left = (width - FILTER_LEAD) % step;
    expect(Math.abs(left - cell / 2)).toBeLessThan(2);
    expect(cell).toBeGreaterThanOrEqual(sizes.minTap);
    expect(Math.abs(thumb - sizes.filterThumb)).toBeLessThan(8);
  });

  it('shows fewer than eleven thumbnails, so the row scrolls', () => {
    const thumb = filterThumbSize(390);
    expect((390 - FILTER_LEAD) / (thumb + 2 * FILTER_RING + FILTER_GAP)).toBeLessThan(11);
  });
});
