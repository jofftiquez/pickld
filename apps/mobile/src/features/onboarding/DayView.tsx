import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SelectField } from '@/components/SelectField';
import { formatTime } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';
import { useLargeText } from '@/lib/useLargeText';

import { DAY_TYPES, timeOptions, type DayTimes, type DayType } from './dayPresets';
import { SetupProgress } from './SetupProgress';

const TYPE_ICON = { early_bird: 'morning', coffee_first: 'afternoon', night_owl: 'evening' } as const;
const SLOTS = ['morning', 'afternoon', 'evening'] as const;

/** A wall-clock time in the phone's locale, e.g. "8:30 AM". */
const clock = (minutes: number) => formatTime(new Date(Date.UTC(2000, 0, 1, 0, minutes)), 'UTC');

export type DayViewProps = {
  insets: EdgeInsets;
  dayType: DayType;
  times: DayTimes;
  busy: boolean;
  failed: boolean;
  onPick: (dayType: DayType) => void;
  onChangeTime: (slot: keyof DayTimes, minutes: number) => void;
  onContinue: () => void;
  /** Absent when there is nowhere to go back to (setup resumed here). */
  onBack?: () => void;
};

/** Your day (FR-ONB-02): three day types that set the reminder times, and Change for picking them by hand. */
export function DayView({
  insets,
  dayType,
  times,
  busy,
  failed,
  onPick,
  onChangeTime,
  onContinue,
  onBack,
}: DayViewProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const [editing, setEditing] = useState(false);
  return (
    <View style={styles.screen} testID="day-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        {onBack ? (
          <RoundIconButton icon="back" accessibilityLabel={t('setup.back')} onPress={onBack} testID="day-back" />
        ) : (
          <View style={styles.backSpace} />
        )}
        <SetupProgress step={2} />
        <View style={styles.heading}>
          <Text
            maxFontSizeMultiplier={maxTextScale.title}
            accessibilityRole="header"
            style={[textStyle('onboardTitle'), { color: colors.ink }]}
          >
            {t('setup.day.title')}
          </Text>
          <Text style={[textStyle('body'), styles.body]}>{t('setup.day.body')}</Text>
        </View>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {DAY_TYPES.map((type) => {
            const selected = type === dayType;
            return (
              <Pressable
                key={type}
                accessibilityRole="radio"
                accessibilityLabel={t(`setup.day.types.${type}.title`)}
                accessibilityHint={t(`setup.day.types.${type}.body`)}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => onPick(type)}
                style={[styles.choice, selected ? styles.choiceSelected : null]}
                testID={`day-${type}`}
              >
                <View style={[styles.icon, { backgroundColor: selected ? colors.brandTint : colors.subtle }]}>
                  <Icon name={TYPE_ICON[type]} color={selected ? 'brandText' : 'ink'} size={22} />
                </View>
                <View style={styles.choiceText}>
                  <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>
                    {t(`setup.day.types.${type}.title`)}
                  </Text>
                  <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>
                    {t(`setup.day.types.${type}.body`)}
                  </Text>
                </View>
                <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]}>
                  {selected ? <Icon name="check" color="surface" size={14} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.nudges, large && styles.wrap]} testID="day-nudges">
          <Icon name="bell" color="surface" size={22} />
          <View style={[styles.nudgesText, large && styles.nudgesTextLarge]}>
            <Text style={[textStyle('label'), { color: colors.onDarkMuted }]}>{t('setup.day.nudges')}</Text>
            <Text style={[textStyle('cardTitle', '800'), { color: colors.surface }]} testID="day-nudge-times">
              {SLOTS.map((s) => clock(times[s])).join(' · ')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? t('setup.day.done') : t('setup.day.changeA11y')}
            accessibilityState={{ expanded: editing }}
            onPress={() => setEditing((e) => !e)}
            hitSlop={hitSlopFor(undefined, 36)}
            style={styles.change}
            testID="day-change"
          >
            <Text style={[textStyle('body', '700'), { color: colors.surface }]}>
              {editing ? t('setup.day.done') : t('setup.day.change')}
            </Text>
          </Pressable>
        </View>
        {editing ? (
          <View style={styles.times}>
            {SLOTS.map((slot) => (
              <SelectField
                key={slot}
                label={t(`setup.day.${slot}`)}
                placeholder={clock(times[slot])}
                options={timeOptions(slot).map((m) => ({ value: m, label: clock(m) }))}
                value={times[slot]}
                onChange={(m) => onChangeTime(slot, m)}
                fullWidthWhenLarge
                testID={`day-time-${slot}`}
              />
            ))}
          </View>
        ) : null}
        {failed ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), { color: colors.danger }]}>
            {t('setup.day.failed')}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <PrimaryButton
          label={busy ? t('setup.day.saving') : t('setup.day.continue')}
          onPress={onContinue}
          disabled={busy}
          testID="day-continue"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: space.xxl, gap: space.lg },
  backSpace: { height: sizes.roundButton },
  heading: { gap: space.xs },
  body: { color: colors.inkSoft, lineHeight: 23 },
  choices: { gap: space.md, marginHorizontal: -space.xs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.md + 2,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceSelected: { borderWidth: 2, borderColor: colors.ink, padding: space.md + 1 },
  icon: {
    width: sizes.quizIcon,
    height: sizes.quizIcon,
    borderRadius: radius.optionIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { flex: 1, gap: 2 },
  check: {
    width: sizes.quizCheck,
    height: sizes.quizCheck,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.brand },
  checkOff: { borderWidth: 2, borderColor: colors.toggleOff },
  nudges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    paddingLeft: space.xl,
    borderRadius: radius.tile,
    backgroundColor: colors.ink,
    marginHorizontal: -space.xs,
  },
  nudgesText: { flex: 1, gap: 2 },
  change: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.onDarkButton,
  },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  // Large text: Change / Done wraps below the times (D-37).
  wrap: { flexWrap: 'wrap', rowGap: space.md },
  nudgesTextLarge: { flexBasis: '70%' },
  spacer: { flex: 1, minHeight: space.lg },
});
