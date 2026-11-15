// Registered names of the loaded Plus Jakarta Sans files (one family per weight in React Native).
// Kept free of imports so tailwind.config.ts can read it.
export const fontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** The text tool's display faces (Pacifico, Anton, Permanent Marker, Caveat Brush). */
export const textFontFamilies = {
  script: 'Pacifico_400Regular',
  strong: 'Anton_400Regular',
  marker: 'PermanentMarker_400Regular',
  hand: 'CaveatBrush_400Regular',
} as const;
