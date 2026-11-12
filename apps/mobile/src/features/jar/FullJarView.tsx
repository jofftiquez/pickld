import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { JarGraphic } from '@/components/JarGraphic';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { formatWeekday } from '@/lib/format';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space, type } from '@/theme/tokens';

import { CelebrationReveal } from './CelebrationReveal';
import { Confetti } from './Confetti';

export type FullJarViewProps = {
  /** The jar's local date (YYYY-MM-DD), for "Your Monday is complete". */
  localDate: string;
  /** The jar number (FR-JAR-08); null when it couldn't be read, and the line leaves it out. */
  jarNumber: number | null;
  lidColor?: string;
  /** Confetti and a pop, or only a fade with Reduce Motion (NFR-A11Y-02). */
  reduceMotion: boolean;
  onDone: () => void;
  /** Opens Publish review; missing when the jar is already published (or unknown), and only Done shows. */
  onPublish?: () => void;
};

/** Full jar celebration over Today (FullJar; FR-JAR-07): the full jar, the day and the jar number. */
export function FullJarView({ localDate, jarNumber, lidColor, reduceMotion, onDone, onPublish }: FullJarViewProps) {
  const { t } = useTranslation();
  return (
    <View testID="full-jar" style={styles.scrim}>
      {reduceMotion ? null : <Confetti />}
      <ScrollView contentContainerStyle={styles.scroll}>
        <CelebrationReveal reduceMotion={reduceMotion} style={styles.card}>
          <View accessibilityViewIsModal style={styles.inner}>
            {/* Decorative: the title and body say the jar is full. */}
            <View style={styles.jar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <JarGraphic count={8} lidColor={lidColor} size={sizes.celebrationJar} decorative />
              <View style={styles.badge}>
                <Text style={[textStyle('label', '800'), { color: colors.ink }]}>{t('fullJar.badge')}</Text>
              </View>
            </View>
            <Text style={[textStyle('eyebrow'), styles.eyebrow]}>{t('fullJar.eyebrow')}</Text>
            <Text
              maxFontSizeMultiplier={maxTextScale.title}
              accessibilityRole="header"
              style={[textStyle('celebrationTitle'), styles.title]}
            >
              {t('fullJar.title', { weekday: formatWeekday(localDate) })}
            </Text>
            <Text testID="full-jar-body" style={[textStyle('bodyMedium', '400'), styles.body]}>
              {jarNumber !== null ? t('fullJar.body', { number: jarNumber }) : t('fullJar.bodyNoNumber')}
            </Text>
            <View style={styles.actions}>
              {/* TODO(M4-11 Share jar card): the design's Share jar card under Publish jar, in place of Done. */}
              {onPublish ? (
                <PrimaryButton
                  label={t('fullJar.publish')}
                  accessibilityHint={t('fullJar.publishHint')}
                  onPress={onPublish}
                  testID="full-jar-publish"
                />
              ) : null}
              {onPublish ? (
                <SecondaryButton
                  label={t('fullJar.done')}
                  accessibilityHint={t('fullJar.doneHint')}
                  onPress={onDone}
                  testID="full-jar-done"
                />
              ) : (
                <PrimaryButton
                  label={t('fullJar.done')}
                  accessibilityHint={t('fullJar.doneHint')}
                  onPress={onDone}
                  testID="full-jar-done"
                />
              )}
            </View>
          </View>
        </CelebrationReveal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.xxl, paddingVertical: space.xxxl * 2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.celebration, ...shadow.dialog },
  inner: {
    paddingTop: space.xxl + 2,
    paddingHorizontal: space.xl + 2,
    paddingBottom: space.xl,
    alignItems: 'center',
    gap: space.sm + 2,
  },
  jar: { position: 'relative' },
  badge: {
    position: 'absolute',
    right: -space.xxxl - space.md,
    top: space.sm - 2,
    backgroundColor: colors.brand,
    borderRadius: radius.countBadge,
    paddingVertical: space.xs + 1,
    paddingHorizontal: space.sm + 2,
    transform: [{ rotate: '10deg' }],
    ...shadow.tile,
  },
  eyebrow: { color: colors.brandText, textTransform: 'uppercase' },
  title: { color: colors.ink, textAlign: 'center' },
  body: { color: colors.inkSoft, textAlign: 'center', lineHeight: Math.round(type.bodyMedium.size * 1.5) },
  actions: { alignSelf: 'stretch', marginTop: space.sm, gap: space.sm },
});
