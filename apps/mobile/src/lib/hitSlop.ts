import type { Insets } from 'react-native';

import { sizes } from '@/theme/tokens';

/**
 * Extra touch area so a control smaller than 44 × 44 still gets a 44 × 44 target (AGENTS rule 11).
 * Pass `undefined` for a width that grows with its content and already meets the minimum.
 */
export function hitSlopFor(width: number | undefined, height: number): Insets {
  const vertical = Math.max(0, Math.ceil((sizes.minTap - height) / 2));
  const horizontal = width === undefined ? 0 : Math.max(0, Math.ceil((sizes.minTap - width) / 2));
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}
