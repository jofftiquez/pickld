import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

export type PastDayBannerProps = {
  /** The past day, already formatted ("Sun, Sep 27"; see `pastDayLabel`). */
  date: string;
  /** Some slot is still empty: "Filling in <day>"; a full day reads "Looking back at <day>". */
  fillable: boolean;
  /** Back to Today: the Today tab. */
  onBackToToday?: () => void;
};

/**
 * The past-day banner under the day page's header (D-156): says this is a past day, not today, and that
 * moments added here show as "Added later", with Back to Today. Calm, like the Time zone banner, on the
 * page's warm paper background.
 */
export function PastDayBanner({ date, fillable, onBackToToday }: PastDayBannerProps) {
  const { t } = useTranslation();
  const title = t(fillable ? 'day.past.fillingTitle' : 'day.past.lookingBackTitle', { date });
  const body = t(fillable ? 'day.past.fillingBody' : 'day.past.lookingBackBody');
  return (
    <View testID="past-day-banner" style={styles.banner}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="myDays" color="pastDayInk" size={20} />
        </View>
        <View accessible accessibilityLabel={`${title}. ${body}`} style={styles.text}>
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.ink }]} testID="past-day-title">
            {title}
          </Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]}>{body}</Text>
        </View>
      </View>
      {onBackToToday ? (
        <View style={styles.action}>
          <PillButton
            variant="subtle"
            icon="today"
            label={t('day.past.backToToday')}
            accessibilityHint={t('day.past.backToTodayHint')}
            onPress={onBackToToday}
            testID="day-back-to-today"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: sizes.bannerPaddingX,
    borderRadius: radius.zoneBanner,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  icon: {
    width: sizes.zoneIcon,
    height: sizes.zoneIcon,
    borderRadius: radius.zoneIcon,
    backgroundColor: colors.pastDayWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space.xs },
  // Under the words, lined up with them.
  action: { flexDirection: 'row', paddingLeft: sizes.zoneIcon + space.md },
});
