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
