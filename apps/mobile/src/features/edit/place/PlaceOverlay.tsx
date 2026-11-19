import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fontFamilies } from '@/theme/fontFamilies';
import { bubbleColors, place } from '@/theme/tokens';

import { registerOverlayRenderer, type OverlayContentProps } from '../overlays/registry';
import { PIN_PATH, PIN_VIEWBOX, placeAspect } from './placeLayout';

/**
 * A place sticker: a pill in its bubble color with the pin and the place's name on one line, centred.
 * Laid out in reference points and scaled to its box (placeLayout.ts), so it looks the same at any size.
 */
export function PlaceOverlay({ overlay, width, height }: OverlayContentProps<'place'>) {
  const k = height / place.referenceHeight;
  const pair = bubbleColors[overlay.color];
  return (
    <View
      style={[
        styles.pill,
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: pair.fill,
          paddingHorizontal: place.paddingX * k,
          gap: place.gap * k,
        },
      ]}
      testID={`place-${overlay.id}`}
    >
      <Svg width={place.icon * k} height={place.icon * k} viewBox={`0 0 ${PIN_VIEWBOX} ${PIN_VIEWBOX}`}>
        <Path d={PIN_PATH} fill={pair.text} fillRule="evenodd" />
      </Svg>
      <Text
        // a11y-fixed-size: part of the picture, same size on every screen, whatever the system text size.
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={[styles.text, { color: pair.text, fontSize: place.fontSize * k }]}
      >
        {overlay.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { flexShrink: 1, fontFamily: fontFamilies.extrabold },
});

/** Draws `place` overlays: the pill sized to its text, the place's name for screen readers. */
export function registerPlaceRenderer(): void {
  registerOverlayRenderer('place', {
    aspect: placeAspect,
    Content: PlaceOverlay,
    accessibilityLabel: (overlay, t) => t('editPlace.overlayLabel', { text: overlay.text }),
  });
}
