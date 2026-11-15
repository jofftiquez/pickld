import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY } from '@/components/BaseButton';
import { GlassSurface } from '@/components/GlassSurface';
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
  /** Fill this jar: the past day being filled (already formatted), shown instead of "Today · time". */
  date?: string;
  /** Opens the moment picker. */
  onPress: () => void;
  /** Nothing to choose (a full past jar). */
  disabled?: boolean;
};

/**
 * The camera's moment control (D-151): "#afternoon ⌄ / Today · 2:14 PM" on glass over the top of the
 * viewfinder. It reads like the slot tag it replaced and opens the moment picker.
 */
export function SlotPill({ slot, time, date, onPress, disabled = false }: SlotPillProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const [pressed, setPressed] = useState(false);
  const label = date ? t('myDays.camera.slotTag', { slot, date }) : t('camera.slotTag', { slot, time });
  const when = date ? t('myDays.camera.when', { date }) : t('camera.when', { time });
  // A pill at default sizes; when large text wraps it onto more lines, the tag's softer corners keep the
  // text clear of the round ends.
  const corner = large ? radius.cameraTag : radius.pill;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('camera.slotHint')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, sizes.minTap)}
      testID="camera-slot-tag"
      style={[
        styles.pill,
        { borderRadius: corner },
        disabled ? { opacity: DISABLED_OPACITY } : pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <GlassSurface
        tone="dark"
        radius={corner}
        tint={colors.liquidDarkTint}
        interactive
        fallbackColor={colors.glass}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.slotRow}>
        <Text style={[textStyle('body', '700'), styles.slot]}>{slot}</Text>
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
    paddingVertical: space.xs + 3,
    paddingHorizontal: space.lg,
  },
  slotRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  slot: { color: colors.surface, textAlign: 'center', flexShrink: 1 },
  // Centered under the slot when it wraps at large text.
  when: { color: colors.onDarkMuted, textAlign: 'center' },
});
