import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { formatShortDate } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import { colors, radius, shadow, sizes } from '@/theme/tokens';

export type DayStepperProps = {
  /** The day before, "YYYY-MM-DD". */
  previous: string;
  /** The day after: a date, 'today' for Today, or null on Today itself (there are no future days). */
  next: string | 'today' | null;
  onStep: (to: string | 'today') => void;
  locale?: string;
};

const ARROW_WIDTH = sizes.minTap;

/** Previous day and Next day (Joff): one pill with two arrows, at the top right of Today and the day page. */
export function DayStepper({ previous, next, onStep, locale }: DayStepperProps) {
  const { t } = useTranslation();
  // The calendar date itself, whatever the phone zone.
  const label = (date: string) => formatShortDate(new Date(`${date}T12:00:00Z`), 'UTC', locale);
  const nextLabel =
    next === null
      ? t('day.step.noNext')
      : next === 'today'
        ? t('day.step.nextToday')
        : t('day.step.next', { date: label(next) });
  return (
    <View style={styles.pill}>
      <Arrow
        icon="back"
        accessibilityLabel={t('day.step.previous', { date: label(previous) })}
        onPress={() => onStep(previous)}
        testID="day-step-previous"
      />
      <View style={styles.divider} />
      <Arrow
        icon="chevronRight"
        accessibilityLabel={nextLabel}
        onPress={next === null ? undefined : () => onStep(next)}
        testID="day-step-next"
      />
    </View>
  );
}

function Arrow({
  icon,
  accessibilityLabel,
  onPress,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  /** Missing: the arrow is off (Next on Today). */
  onPress?: () => void;
  testID: string;
}) {
  const disabled = onPress === undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlopFor(ARROW_WIDTH, sizes.dayStepper)}
      testID={testID}
      style={({ pressed }) => [
        styles.arrow,
        disabled ? { opacity: DISABLED_OPACITY } : pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <Icon name={icon} color="ink" size={20} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: sizes.dayStepper,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  arrow: { width: ARROW_WIDTH, height: sizes.dayStepper, alignItems: 'center', justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: sizes.dayStepper / 2, backgroundColor: colors.border },
});
