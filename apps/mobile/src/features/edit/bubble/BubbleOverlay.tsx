import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fontFamilies } from '@/theme/fontFamilies';
import { bubble, bubbleColors } from '@/theme/tokens';

import { registerOverlayRenderer, type OverlayContentProps } from '../overlays/registry';
import { bubbleAspect, bubbleLines, paddingXFor } from './bubbleLayout';

function shapeStyle(shape: OverlayContentProps<'bubble'>['overlay']['shape'], k: number, height: number): ViewStyle {
  switch (shape) {
    case 'speech':
      return { borderRadius: bubble.radius * k, borderBottomLeftRadius: bubble.tailRadius * k };
    case 'thought':
      return { borderRadius: height / 2 };
    case 'shout':
      return { borderRadius: bubble.shoutRadius * k, transform: [{ skewX: bubble.shoutSkew }] };
    case 'whisper':
      return { borderRadius: bubble.whisperRadius * k, borderStyle: 'dashed', borderWidth: bubble.whisperBorder * k };
  }
}

/**
 * A speech bubble (design: Bubble): the shape filled with its color and the user's text, laid out at the
 * reference width and scaled to fill the overlay's box.
 */
export function BubbleOverlay({ overlay, width, height }: OverlayContentProps<'bubble'>) {
  const { shape, color, text } = overlay;
  const k = width / bubble.referenceWidth;
  const pair = bubbleColors[color];
  return (
    <View
      style={[
        styles.body,
        {
          width,
          height,
          backgroundColor: pair.fill,
          borderColor: pair.text,
          paddingHorizontal: paddingXFor(shape) * k,
          paddingVertical: bubble.paddingY * k,
        },
        shapeStyle(shape, k, height),
      ]}
      testID={`bubble-${overlay.id}`}
    >
      {text === '' ? null : (
        <Text
          // Part of the picture: same size on every screen, whatever the system text size.
          allowFontScaling={false}
          numberOfLines={bubbleLines(text, shape)}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[
            styles.text,
            {
              color: pair.text,
              fontFamily: shape === 'shout' ? fontFamilies.extrabold : fontFamilies.bold,
              fontSize: bubble.fontSize * k,
              lineHeight: bubble.lineHeight * k,
            },
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { justifyContent: 'center', ...bubble.shadow },
  text: { textAlign: 'center' },
});

/** Draws `bubble` overlays with their shape, color and text (call once, before any placeholder). */
export function registerBubbleRenderer(): void {
  registerOverlayRenderer('bubble', {
    aspect: bubbleAspect,
    Content: BubbleOverlay,
    accessibilityLabel: (overlay, t) => {
      const shape = t(`editBubble.shape.${overlay.shape}`);
      return overlay.text === ''
        ? t('editBubble.labelEmpty', { shape })
        : t('editBubble.label', { shape, text: overlay.text });
    },
  });
}
