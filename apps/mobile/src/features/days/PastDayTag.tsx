import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { textStyle } from '@/theme/text';
import { colors, radius, space } from '@/theme/tokens';

export type PastDayTagProps = {
  /** Some slot is still empty: "Past day · Added later"; a full day reads "Past day". */
  fillable: boolean;
};

/**
 * The past-day tag on the day page's date line (D-156): says this is a past day, not today, and while a slot
 * is empty that moments added here show as "Added later". Small, so the page's warm paper does most of the
 * telling (Joff: the earlier banner took too much of the screen); the screen reader hears the full sentence.
 */
export function PastDayTag({ fillable }: PastDayTagProps) {
  const { t } = useTranslation();
  const title = t(fillable ? 'day.past.fillingTitle' : 'day.past.lookingBackTitle');
  const body = t(fillable ? 'day.past.fillingBody' : 'day.past.lookingBackBody');
  return (
    <View testID="past-day-banner" accessible accessibilityLabel={body} style={styles.tag}>
      <Icon name="myDays" color="pastDayInk" size={14} />
      <Text style={[textStyle('label', '700'), styles.text]} testID="past-day-title">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.pastDayWell,
    maxWidth: '100%',
  },
  // Wraps inside the tag at large text sizes instead of running off the screen.
  text: { flexShrink: 1, color: colors.pastDayInk },
});
