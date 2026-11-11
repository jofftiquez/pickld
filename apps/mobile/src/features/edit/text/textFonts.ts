import { Platform, type TextStyle } from 'react-native';

import { fontFamilies } from '@/theme/fontFamilies';

import type { TextFont } from './textOverlay';

// The text tool's four fonts (design: Text). Clean and Bold are the bundled Plus Jakarta Sans; Type and
// Serif use the monospace and serif faces every iOS and Android device already has, so the app bundles
// no new font.
const families: Record<TextFont, string> = {
  clean: fontFamilies.semibold,
  bold: fontFamilies.extrabold,
  type: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
};

/** Letter spacing as a fraction of the font size (Bold is tightened, -0.02em, as designed). */
const tracking: Record<TextFont, number> = { clean: 0, bold: -0.02, type: 0, serif: 0 };

/** Family, tracking and slant for a text font at a size. */
export function textFontStyle(font: TextFont, fontSize: number): TextStyle {
  return {
    fontFamily: families[font],
    fontSize,
    letterSpacing: tracking[font] * fontSize,
    fontStyle: font === 'serif' ? 'italic' : 'normal',
  };
}
