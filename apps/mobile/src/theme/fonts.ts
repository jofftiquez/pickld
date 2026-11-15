import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { textFontFamilies } from './fontFamilies';

// React Native needs one family per weight for custom fonts. The text tool's display faces are free
// fonts (licenses beside them in assets/fonts), the same files pickld.me and the export draw with.
export const fontFiles = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  [textFontFamilies.script]: require('../../assets/fonts/Pacifico-Regular.ttf'),
  [textFontFamilies.strong]: require('../../assets/fonts/Anton-Regular.ttf'),
  [textFontFamilies.marker]: require('../../assets/fonts/PermanentMarker-Regular.ttf'),
  [textFontFamilies.hand]: require('../../assets/fonts/CaveatBrush-Regular.ttf'),
};

export { fontFamilies } from './fontFamilies';
