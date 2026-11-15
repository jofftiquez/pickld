import { sizes, space } from '@/theme/tokens';

import { FILTER_COLUMNS, FILTER_GAP, FILTER_RING, filterThumbSize } from '../filterGrid';

// The filters show as a grid of four columns that fills the panel without overflowing it (editor feedback, QA round 6).

describe('filterThumbSize', () => {
  it.each([375, 390, 393, 402, 430, 440])('fills a %i pt wide screen with four thumbnails', (screen) => {
    const width = screen - 2 * space.xl;
    const thumb = filterThumbSize(width);
    const row = FILTER_COLUMNS * (thumb + 2 * FILTER_RING) + (FILTER_COLUMNS - 1) * FILTER_GAP;
    expect(row).toBeLessThanOrEqual(width);
    expect(width - row).toBeLessThan(FILTER_COLUMNS);
    expect(thumb).toBeGreaterThan(sizes.filterThumb);
  });
});
