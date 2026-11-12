import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { IntroArt } from './IntroArt';

export const INTRO_STEPS = 3;
export type IntroStep = 1 | 2 | 3;

export type IntroViewProps = {
  step: IntroStep;
  insets: EdgeInsets;
  onBack: () => void;
  /** Skip, and Create my account on the last page: both go to Sign up. */
  onSignUp: () => void;
  onNext: () => void;
};

/** How it works (Intro1–3; FR-ONB-01): an illustration, title, body, page dots, Next, and Skip on every page. */
export function IntroView({ step, insets, onBack, onSignUp, onNext }: IntroViewProps) {
  const { t } = useTranslation();
  const last = step === INTRO_STEPS;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID={`intro-${step}`}>
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('intro.back')} onPress={onBack} testID="intro-back" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('intro.skipA11y')}
          onPress={onSignUp}
          hitSlop={hitSlopFor(undefined, 20)}
          style={styles.skip}
          testID="intro-skip"
        >
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>{t('intro.skip')}</Text>
        </Pressable>
      </View>
      <IntroArt step={step} />
      <View style={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('onboardTitle'), { color: colors.ink }]}
        >
          {t(`intro.${step}.title`)}
        </Text>
        <Text style={[textStyle('body'), styles.text]}>{t(`intro.${step}.body`)}</Text>
        <View style={styles.spacer} />
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('intro.page', { page: step, count: INTRO_STEPS })}
          testID="intro-dots"
        >
          {Array.from({ length: INTRO_STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, i + 1 === step ? styles.dotActive : null]} />
          ))}
        </View>
        <PrimaryButton
          label={last ? t('intro.create') : t('intro.next')}
          onPress={last ? onSignUp : onNext}
          testID="intro-next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
  },
  skip: { paddingVertical: space.md, paddingHorizontal: space.xs },
  body: { flex: 1, paddingHorizontal: space.xxxl, gap: space.md },
  text: { color: colors.inkSoft, lineHeight: 22 },
  spacer: { flex: 1 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: sizes.pageDot, height: sizes.pageDot, borderRadius: radius.pill, backgroundColor: colors.handle },
  dotActive: { width: sizes.pageDotActive, backgroundColor: colors.brand },
});
