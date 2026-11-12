import { useWindowDimensions } from 'react-native';

import { LARGE_TEXT_SCALE } from '@/theme/text';

/**
 * True when the system text size is large (1.5× or more, NFR-A11Y-02). Rows that put a label next to a
 * chip, switch or button stack instead, so the label keeps its full width and words never break mid-word.
 */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
}
