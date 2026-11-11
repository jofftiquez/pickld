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
};

/** "#afternoon / Today · 2:14 PM" over the top of the viewfinder (Camera). */
export function SlotTag({ slot, time, date }: SlotTagProps) {
  const { t } = useTranslation();
  const label = date ? t('myDays.camera.slotTag', { slot, date }) : t('camera.slotTag', { slot, time });
  const when = date ? t('myDays.camera.when', { date }) : t('camera.when', { time });
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={label} style={styles.tag} testID="camera-slot-tag">
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={[textStyle('body', '700'), { color: colors.surface }]}>{slot}</Text>
      <Text style={[textStyle('caption', '500'), { color: colors.onDarkMuted }]}>{when}</Text>
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
});
