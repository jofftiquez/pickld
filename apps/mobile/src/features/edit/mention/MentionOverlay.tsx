import { StyleSheet, Text, View } from 'react-native';

import { fontFamilies } from '@/theme/fontFamilies';
import { bubbleColors, place } from '@/theme/tokens';

import { registerOverlayRenderer, type OverlayContentProps } from '../overlays/registry';
import { mentionAspect, mentionText } from './mentionLayout';

/** A mention sticker: "@username" centred in a pill of its bubble color, the Place pill without the pin. */
export function MentionOverlay({ overlay, width, height }: OverlayContentProps<'mention'>) {
  const k = height / place.referenceHeight;
  const pair = bubbleColors[overlay.color];
  return (
    <View
      style={[
        styles.pill,
        { width, height, borderRadius: height / 2, backgroundColor: pair.fill, paddingHorizontal: place.paddingX * k },
      ]}
      testID={`mention-${overlay.id}`}
    >
      <Text
        // a11y-fixed-size: part of the picture, same size on every screen, whatever the system text size.
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={[styles.text, { color: pair.text, fontSize: place.fontSize * k }]}
      >
        {mentionText(overlay.username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { flexShrink: 1, fontFamily: fontFamilies.extrabold },
});

/** Draws `mention` overlays: the pill sized to the username, "Tagged @name" for screen readers. */
export function registerMentionRenderer(): void {
  registerOverlayRenderer('mention', {
    aspect: mentionAspect,
    Content: MentionOverlay,
    accessibilityLabel: (overlay, t) => t('editMention.overlayLabel', { username: overlay.username }),
  });
}
