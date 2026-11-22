import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { GUIDE_PAGES, GuideArt } from './GuideArt';

export type GuideViewProps = {
  /** 1 to GUIDE_PAGES. */
  page: number;
  insets: EdgeInsets;
  onBack: () => void;
  onNext: () => void;
  /** Done in the header on any page, and the button on the last page. */
  onDone: () => void;
};

/**
 * How Pickld works (FR-ONB-10): five pages in the layout of the intro pages (IntroView), opened only by choice
 * from the First moment sheet, Help & feedback or Settings. Done closes it on any page.
 */
export function GuideView({ page, insets, onBack, onNext, onDone }: GuideViewProps) {
  const { t } = useTranslation();
  const last = page === GUIDE_PAGES;
  const pages = t('guide.pages', { returnObjects: true }) as unknown as { title: string; body: string }[];
  const copy = pages[page - 1];
  return (
    // Scrolls only when the content is taller than the screen (large text), so Next stays reachable.
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
      bounces={false}
      testID={`guide-${page}`}
    >
      <View style={styles.header}>
        {page > 1 ? (
          <RoundIconButton icon="back" accessibilityLabel={t('guide.back')} onPress={onBack} testID="guide-back" />
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('guide.doneA11y')}
          onPress={onDone}
          hitSlop={hitSlopFor(undefined, 20)}
          style={styles.done}
          testID="guide-done"
        >
          <Text
            maxFontSizeMultiplier={maxTextScale.control}
            style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}
          >
            {t('guide.done')}
          </Text>
        </Pressable>
      </View>
      <GuideArt page={page} />
      <View style={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('onboardTitle'), { color: colors.ink }]}
        >
          {copy?.title}
        </Text>
        <Text style={[textStyle('body'), styles.text]}>{copy?.body}</Text>
        <View style={styles.spacer} />
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('guide.page', { page, count: GUIDE_PAGES })}
          testID="guide-dots"
        >
          {Array.from({ length: GUIDE_PAGES }, (_, i) => (
            <View key={i} style={[styles.dot, i + 1 === page ? styles.dotActive : null]} />
          ))}
        </View>
        <PrimaryButton
          label={last ? t('guide.done') : t('guide.next')}
          onPress={last ? onDone : onNext}
          testID="guide-next"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
  },
  headerSpacer: { width: sizes.roundButton, height: sizes.roundButton },
  done: { paddingVertical: space.md, paddingHorizontal: space.xs },
  body: { flex: 1, paddingHorizontal: space.xxxl, gap: space.md },
  text: { color: colors.inkSoft, lineHeight: 22 },
  spacer: { flex: 1 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: sizes.pageDot, height: sizes.pageDot, borderRadius: radius.pill, backgroundColor: colors.handle },
  dotActive: { width: sizes.pageDotActive, backgroundColor: colors.brand },
});
