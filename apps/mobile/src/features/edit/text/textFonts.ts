import { Platform, type TextStyle } from 'react-native';

import { fontFamilies, textFontFamilies } from '@/theme/fontFamilies';

import { TEXT_TRACKING, type TextFont } from './textOverlay';

// The text tool's fonts (design: Text). Clean and Bold are the bundled Plus Jakarta Sans; Type and Serif
// use the monospace and serif faces every iOS and Android device already has; Script, Strong, Marker and
// Hand are free display faces the app bundles (theme/fonts.ts).
const families: Record<TextFont, string> = {
  clean: fontFamilies.semibold,
  bold: fontFamilies.extrabold,
  type: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  ...textFontFamilies,
};

/** Family, tracking and slant for a text font at a size. */
export function textFontStyle(font: TextFont, fontSize: number): TextStyle {
  return {
    fontFamily: families[font],
    fontSize,
    letterSpacing: TEXT_TRACKING[font] * fontSize,
    fontStyle: font === 'serif' ? 'italic' : 'normal',
  };
}
