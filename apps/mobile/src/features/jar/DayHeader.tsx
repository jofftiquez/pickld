import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RoundIconButton } from '@/components/RoundIconButton';
import { formatDate, formatWeekday } from '@/lib/format';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

export type DayHeaderProps = {
  /** The past day shown, "YYYY-MM-DD". */
  date: string;
  onBack: () => void;
  /** Previous day / Next day (`DayStepper`), across from Back. */
  stepper?: ReactNode;
  /** The past-day tag (`PastDayTag`), after the date line's date. */
  tag?: ReactNode;
  locale?: string;
};

/** The day page's header (D-55; Day, from Main): Back, then the date (with the past-day tag) and its weekday as the title. */
export function DayHeader({ date, onBack, stepper = null, tag = null, locale }: DayHeaderProps) {
  const { t } = useTranslation();
  // The calendar date itself, whatever the phone zone.
  const fullDate = formatDate(new Date(`${date}T12:00:00Z`), 'UTC', locale);
  return (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <RoundIconButton icon="back" accessibilityLabel={t('day.back')} onPress={onBack} testID="day-back" />
        {stepper}
      </View>
      <View style={styles.titles}>
        <View style={styles.dateLine}>
          <Text style={[textStyle('bodySmall', '600'), { color: colors.muted }]} testID="day-subtitle">
            {fullDate}
          </Text>
          {tag}
        </View>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          testID="screen-title"
          accessibilityRole="header"
          accessibilityLabel={t('day.titleLabel', { weekday: formatWeekday(date, locale), date: fullDate })}
          style={[textStyle('screenTitle'), { color: colors.ink }]}
        >
          {formatWeekday(date, locale)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titles: { gap: space.xs / 2 },
  // The tag drops under the date when the two don't fit on one line (large text sizes).
  dateLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm, rowGap: space.xs },
});
