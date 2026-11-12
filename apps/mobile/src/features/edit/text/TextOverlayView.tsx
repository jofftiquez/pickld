import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

import type { OverlayContentProps } from '../overlays/registry';
import { textFontStyle } from './textFonts';
import { layoutText, textColorValues } from './textOverlay';

/** The design's shadow at its 30-point text: 0 2px 10px. */
const SHADOW_AT_30 = { offset: 2, radius: 10 };

/**
 * A text overlay drawn in its box (FR-CAP-07). Everything scales with the box, so the photo looks the
 * same at any size. Lines are broken by layoutText, not the text engine. Light colors get a dark shadow
 * and ink a light one, so the words read on any photo. It is part of the photo, so it ignores the
 * system text size.
 */
export function TextOverlayView({ overlay, width }: OverlayContentProps<'text'>) {
  const layout = layoutText(overlay);
  const k = width / layout.width;
  const fontSize = layout.fontSize * k;
  const shadow = fontSize / 30;
  return (
    <View
      style={{ paddingHorizontal: layout.padX * k, paddingVertical: layout.padY * k }}
      testID={`text-overlay-${overlay.id}`}
    >
      {/* a11y-fixed-size: drawn into the photo at the photo's scale, not the phone's text size */}
      <Text
        allowFontScaling={false}
        style={[
          textFontStyle(overlay.font, fontSize),
          styles.text,
          {
            color: textColorValues[overlay.color],
            lineHeight: layout.lineHeight * k,
            textAlign: overlay.align,
            textShadowColor: overlay.color === 'ink' ? colors.textOverlayShadowOnDark : colors.textOverlayShadow,
            textShadowOffset: { width: 0, height: SHADOW_AT_30.offset * shadow },
            textShadowRadius: SHADOW_AT_30.radius * shadow,
          },
        ]}
      >
        {layout.lines.join('\n')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The box is a little generous; the text never wraps on its own.
  text: { includeFontPadding: false },
});
