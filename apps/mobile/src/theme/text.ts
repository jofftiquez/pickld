import type { TextStyle } from 'react-native';

import { fontFamilies } from './fontFamilies';
import { type } from './tokens';

export type TextVariant = keyof typeof type;
export type FontWeight = '400' | '500' | '600' | '700' | '800';

const familyByWeight: Record<FontWeight, string> = {
  '400': fontFamilies.regular,
  '500': fontFamilies.medium,
  '600': fontFamilies.semibold,
  '700': fontFamilies.bold,
  '800': fontFamilies.extrabold,
};

/**
 * Font family, size and tracking for a type token. React Native needs one family per weight, so the
 * weight picks the family instead of setting fontWeight. Sizes scale with the system text size.
 */
export function textStyle(variant: TextVariant, weight?: FontWeight): TextStyle {
  const t = type[variant];
  return {
    fontFamily: familyByWeight[weight ?? t.weight],
    fontSize: t.size,
    ...('letterSpacing' in t ? { letterSpacing: t.letterSpacing } : null),
  };
}

/** From this system text size on, side-by-side rows stack (useLargeText, NFR-A11Y-02, D-37). */
export const LARGE_TEXT_SCALE = 1.5;

/**
 * How far text may grow with the system size where its box can't (D-37). Everything else scales freely.
 * - title: screen and onboarding titles are already 30–32 pt; 1.5× (45–48 pt) keeps one long word, like
 *   "Notifications", on one line.
 * - tabLabel: the floating tab bar's labels, like iOS's own tab bar, grow only a little.
 * - tile: labels drawn inside a fixed-size photo tile; the tile's screen reader label has the full text.
 * - control: labels inside a control's fixed width (segments, filter names, the moment preview's actions)
 *   grow to 200% (NFR-A11Y-02); where even that won't fit they shrink rather than break mid-word.
 */
export const maxTextScale = { title: 1.5, tabLabel: 1.2, tile: 1.3, control: 2 } as const;
