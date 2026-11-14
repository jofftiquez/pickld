import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, radius, space } from '@/theme/tokens';

export type SlotTagProps = {
  slot: string;
  /** Already formatted for the phone's locale, e.g. "2:14 PM". */
  time: string;
  /** Fill this jar: the past day being filled (already formatted), shown instead of "Today · time". */
  date?: string;
  /** The editor, for a photo taken on another day: that day (already formatted), so the tag reads
   * "9:00 AM · Thu, Nov 12" instead of "Today · 9:00 AM". */
  shotOn?: string | null;
};

/** "#afternoon / Today · 2:14 PM" over the top of the viewfinder (Camera). */
export function SlotTag({ slot, time, date, shotOn }: SlotTagProps) {
  const { t } = useTranslation();
  const label = date
    ? t('myDays.camera.slotTag', { slot, date })
    : shotOn
      ? t('camera.slotTagOn', { slot, time, date: shotOn })
      : t('camera.slotTag', { slot, time });
  const when = date
    ? t('myDays.camera.when', { date })
    : shotOn
      ? // No-break spaces: when the tag wraps at large text, the date moves down whole.
        t('camera.whenOn', { time, date: shotOn.replace(/ /g, '\u00a0') })
      : t('camera.when', { time });
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={label} style={styles.tag} testID="camera-slot-tag">
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={[textStyle('body', '700'), { color: colors.surface }]}>{slot}</Text>
      <Text style={[textStyle('caption', '500'), styles.when]}>{when}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignItems: 'center',
    flexShrink: 1,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderRadius: radius.cameraTag,
    paddingVertical: space.xs + 3,
    paddingHorizontal: space.lg,
  },
  // Centered under the slot when it wraps at large text.
  when: { color: colors.onDarkMuted, textAlign: 'center' },
});
