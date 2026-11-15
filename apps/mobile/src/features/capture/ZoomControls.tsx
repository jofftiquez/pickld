import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { formatFactor, type ZoomStop } from './cameraZoom';

export type ZoomControlsProps = {
  /** One button per stop (0.5×, 1×, 2×, 3×); none for a single-lens camera. */
  stops: readonly ZoomStop[];
  /** Index of the highlighted button, -1 for none. */
  selected: number;
  /** The zoom while a pinch is under way, shown above the buttons; null when not pinching. */
  pinchFactor: number | null;
  onSelect: (stop: ZoomStop) => void;
};

/**
 * Lens buttons over the bottom of the viewfinder (D-144), and the zoom readout while pinching. The buttons are
 * also the screen-reader way to zoom: each says "Zoom 2 times" and reports when it is selected.
 */
export function ZoomControls({ stops, selected, pinchFactor, onSelect }: ZoomControlsProps) {
  const { t } = useTranslation();
  // The chip is an inner view, so its look doesn't depend on how Pressable takes styles; pressed state lives here.
  const [pressed, setPressed] = useState<number | null>(null);
  if (stops.length === 0 && pinchFactor === null) return null;
  return (
    <View style={styles.root} pointerEvents="box-none">
      {pinchFactor !== null ? (
        <View
          style={styles.readout}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          testID="camera-zoom-readout"
        >
          <Text style={[textStyle('label', '700'), styles.readoutText]} maxFontSizeMultiplier={maxTextScale.control}>
            {t('camera.zoomFactor', { factor: formatFactor(pinchFactor) })}
          </Text>
        </View>
      ) : null}
      {stops.length > 0 ? (
        <View style={styles.row} pointerEvents="box-none" testID="camera-zoom-buttons">
          {stops.map((stop, index) => {
            const on = index === selected;
            const factor = formatFactor(stop.factor);
            return (
              <Pressable
                key={factor}
                accessibilityRole="button"
                accessibilityLabel={t('camera.zoomButton', { factor })}
                accessibilityState={{ selected: on }}
                hitSlop={hitSlopFor(sizes.zoomButton, sizes.zoomButton)}
                onPress={() => onSelect(stop)}
                onPressIn={() => setPressed(index)}
                onPressOut={() => setPressed(null)}
                testID={`camera-zoom-${factor}`}
              >
                <View
                  testID={`camera-zoom-chip-${factor}`}
                  style={[
                    styles.button,
                    on ? styles.buttonOn : null,
                    pressed === index ? { opacity: PRESSED_OPACITY } : null,
                  ]}
                >
                  <Text
                    style={[textStyle('caption'), { color: on ? colors.ink : colors.surface }]}
                    maxFontSizeMultiplier={maxTextScale.control}
                  >
                    {t('camera.zoomFactor', { factor })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space.sm },
  readout: {
    backgroundColor: colors.badge,
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY,
    paddingHorizontal: space.sm + 2,
  },
  readoutText: { color: colors.surface },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // The 44 pt tap areas (hitSlop) of neighbouring buttons meet but don't overlap.
    gap: sizes.minTap - sizes.zoomButton,
  },
  button: {
    minWidth: sizes.zoomButton,
    minHeight: sizes.zoomButton,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.badge,
  },
  buttonOn: { backgroundColor: colors.surface },
});
