import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { hitSlopFor } from '@/lib/hitSlop';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type SlotPillProps = {
  /** The slot's hashtag, already translated, e.g. "#afternoon". */
  slot: string;
  /** Already formatted for the phone's locale, e.g. "2:14 PM". */
  time: string;
  /** Opens the moment picker. */
  onPress: () => void;
};

/**
 * The camera's moment control (D-151): "#afternoon ⌄ / Today · 2:14 PM" frosted over the top of the
 * viewfinder. It reads like the slot tag it replaced and opens the moment picker.
 */
export function SlotPill({ slot, time, onPress }: SlotPillProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const [pressed, setPressed] = useState(false);
  const label = t('camera.slotTag', { slot, time });
  const when = t('camera.when', { time });
  // A pill at default sizes; when large text wraps it onto more lines, the tag's softer corners keep the
  // text clear of the round ends.
  const corner = large ? radius.cameraTag : radius.pill;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('camera.slotHint')}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, sizes.minTap)}
      testID="camera-slot-tag"
      style={[styles.pill, { borderRadius: corner }, pressed ? { opacity: PRESSED_OPACITY } : null]}
    >
      {/* The slot tag's dark frosted blur, not Liquid Glass: its light tint washes out the white time line
          over a bright scene. */}
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.slotRow}>
        {/* One line: at the largest text sizes a hashtag broken mid-word ("#aftern / oon") reads badly, so
            it shrinks to fit the space between Close and flash instead. */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[textStyle('body', '700'), styles.slot]}
        >
          {slot}
        </Text>
        <Icon name="chevronDown" color="surface" size={sizes.slotPillChevron} strokeWidth={2.4} />
      </View>
      <Text style={[textStyle('caption', '500'), styles.when]}>{when}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    minHeight: sizes.minTap,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    // A faint edge, so it reads as a control and not a caption.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.onDarkControl,
    paddingVertical: space.xs + 3,
    paddingHorizontal: space.lg,
  },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  slot: { color: colors.surface, textAlign: 'center', flexShrink: 1 },
  // Centered under the slot when it wraps at large text.
  when: { color: colors.onDarkMuted, textAlign: 'center' },
});
