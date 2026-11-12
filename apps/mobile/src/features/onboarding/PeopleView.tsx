import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { isSelected, PEOPLE_OPTIONS, type PeopleAnswers } from './peopleModel';
import { SetupProgress } from './SetupProgress';

const GROUPS = ['whoamiwith', 'mebusywith', 'ootd'] as const;

export type PeopleViewProps = {
  insets: EdgeInsets;
  answers: PeopleAnswers;
  busy: boolean;
  failed: boolean;
  onToggle: (group: (typeof GROUPS)[number], key: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
};

/** Your people (FR-ONB-03): private, skippable chips for #whoamiwith, #mebusywith and #ootd. */
export function PeopleView({ insets, answers, busy, failed, onToggle, onContinue, onSkip, onBack }: PeopleViewProps) {
  const { t } = useTranslation();
  // One object per group, so each label is looked up by its own group's keys.
  const labels = t('setup.people.options', { returnObjects: true }) as Record<
    (typeof GROUPS)[number],
    Record<string, string>
  >;
  return (
    <View style={styles.screen} testID="people-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        {onBack ? (
          <RoundIconButton icon="back" accessibilityLabel={t('setup.back')} onPress={onBack} testID="people-back" />
        ) : (
          <View style={styles.backSpace} />
        )}
        <SetupProgress step={3} />
        <View style={styles.heading}>
          <Text
            maxFontSizeMultiplier={maxTextScale.title}
            accessibilityRole="header"
            style={[textStyle('onboardTitle'), { color: colors.ink }]}
          >
            {t('setup.people.title')}
          </Text>
          <Text style={[textStyle('body'), styles.body]}>{t('setup.people.body')}</Text>
        </View>
        {GROUPS.map((group) => (
          <View key={group} style={styles.group}>
            <View style={styles.question}>
              <View style={styles.icon}>
                <Icon name={group} color="brandText" size={18} />
              </View>
              <Text accessibilityRole="header" style={[textStyle('body', '700'), { color: colors.ink }]}>
                {t(`setup.people.${group}`)}
              </Text>
            </View>
            <View style={styles.chips}>
              {PEOPLE_OPTIONS[group].map((key) => (
                <Chip
                  key={key}
                  label={labels[group][key] ?? key}
                  selected={isSelected(answers, group, key)}
                  onPress={() => onToggle(group, key)}
                  testID={`people-${group}-${key}`}
                />
              ))}
            </View>
          </View>
        ))}
        {failed ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), { color: colors.danger }]}>
            {t('setup.people.failed')}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <PrimaryButton
          label={busy ? t('setup.people.saving') : t('setup.people.continue')}
          onPress={onContinue}
          disabled={busy}
          testID="people-continue"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('setup.people.skip')}
          onPress={onSkip}
          disabled={busy}
          hitSlop={hitSlopFor(undefined, 24)}
          style={styles.skip}
          testID="people-skip"
        >
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>{t('setup.people.skip')}</Text>
        </Pressable>
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
  group: { gap: space.md },
  question: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: sizes.peopleIcon,
    height: sizes.peopleIcon,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  spacer: { flex: 1, minHeight: space.md },
  skip: { alignItems: 'center', paddingVertical: space.xs },
});
