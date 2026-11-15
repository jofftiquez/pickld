import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

import type { OverlayContentProps } from '../overlays/registry';
import { textFontStyle } from './textFonts';
import {
  BACKGROUND_RADIUS,
  layoutText,
  outlineOffsets,
  textBoxColors,
  textColorValues,
  textStyleOf,
} from './textOverlay';

/** The design's shadow at its 30-point text: 0 2px 10px. */
const SHADOW_AT_30 = { offset: 2, radius: 10 };

/**
 * A text overlay drawn in its box (FR-CAP-07). Everything scales with the box, so the photo looks the
 * same at any size. Lines are broken by layoutText, not the text engine. With no background or outline,
 * light colors get a dark shadow and ink a light one, so the words read on any photo. A solid background
 * is the color with the words in white or ink on it; a soft one is a see-through wash of the contrasting
 * color under the colored words. An outline is the words drawn in its color round a small circle under
 * them. It is part of the photo, so it ignores the system text size.
 */
export function TextOverlayView({ overlay, width }: OverlayContentProps<'text'>) {
  const style = textStyleOf(overlay);
  const layout = layoutText(overlay);
  const k = width / layout.width;
  const fontSize = layout.fontSize * k;
  const shadow = fontSize / 30;
  const { words, box: background } = textBoxColors(style);
  const { outline } = style;
  const plain = style.background === 'none' && outline === undefined;
  const lines = layout.lines.join('\n');
  const font = [
    textFontStyle(style.font, fontSize),
    styles.text,
    { lineHeight: layout.lineHeight * k, textAlign: style.align },
  ];
  const pad = { paddingHorizontal: layout.padX * k, paddingVertical: layout.padY * k };
  return (
    <View
      style={background ? { backgroundColor: background, borderRadius: BACKGROUND_RADIUS * fontSize } : null}
      testID={`text-overlay-${overlay.id}`}
    >
      {outline
        ? outlineOffsets().map(({ dx, dy }, i) => (
            // a11y-fixed-size: part of the photo, drawn at the photo's scale
            <Text
              key={i}
              allowFontScaling={false}
              importantForAccessibility="no"
              accessibilityElementsHidden
              style={[
                font,
                styles.outline,
                pad,
                {
                  color: textColorValues[outline],
                  transform: [{ translateX: dx * fontSize }, { translateY: dy * fontSize }],
                },
              ]}
              testID={i === 0 ? `text-overlay-${overlay.id}-outline` : undefined}
            >
              {lines}
            </Text>
          ))
        : null}
      {/* a11y-fixed-size: drawn into the photo at the photo's scale, not the phone's text size */}
      <Text
        allowFontScaling={false}
        style={[
          font,
          // The padding is the words' own, so a slanted letter at a line's end draws into it instead of
          // being cut off at the edge of the words.
          pad,
          { color: words },
          plain
            ? {
                textShadowColor: style.color === 'ink' ? colors.textOverlayShadowOnDark : colors.textOverlayShadow,
                textShadowOffset: { width: 0, height: SHADOW_AT_30.offset * shadow },
                textShadowRadius: SHADOW_AT_30.radius * shadow,
              }
            : null,
        ]}
      >
        {lines}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The box is a little generous; the text never wraps on its own.
  text: { includeFontPadding: false },
  // Each copy fills the box exactly as the words do, under them.
  outline: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
