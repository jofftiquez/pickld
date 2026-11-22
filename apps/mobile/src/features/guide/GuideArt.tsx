import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { JarGraphic } from '@/components/JarGraphic';
import { IntroArt } from '@/features/onboarding/IntroArt';
import { onboardingPhotos, type OnboardingPhoto } from '@/features/onboarding/photos';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

export const GUIDE_PAGES = 5;

/** Page 3: each moment's visibility, and a jar ready to publish. */
function Share() {
  const { t } = useTranslation();
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        {(['readers', 'everyone', 'onlyMe'] as const).map((k, i) => (
          <View key={k} style={[styles.row, i > 0 ? styles.divider : null]}>
            <View style={[styles.radio, i === 0 ? styles.radioOn : null]} />
            <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('bodyMedium', '700'), styles.ink]}>
              {t(`visibility.${k}`)}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.card, styles.row]}>
        <JarGraphic count={3} size={sizes.tipJar} decorative />
        <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('bodyMedium', '700'), styles.grow]}>
          {t('jar.moments', { count: 3, total: 8 })}
        </Text>
        <View style={styles.pill}>
          <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('bodySmall', '800'), styles.onBrand]}>
            {t('today.publish')}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Page 4: the people you read, newest first. */
function People() {
  const rows: OnboardingPhoto[] = ['food', 'ootd', 'evening'];
  return (
    <View style={styles.card}>
      {rows.map((photo, i) => (
        <View key={photo} style={[styles.row, i > 0 ? styles.divider : null]}>
          <Image source={onboardingPhotos[photo]} style={styles.thumb} contentFit="cover" accessible={false} />
          <View style={styles.grow}>
            <View style={[styles.bar, { width: `${80 - i * 15}%` }]} />
            <View style={[styles.bar, styles.barSoft, { width: `${50 - i * 10}%` }]} />
          </View>
          <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('bodyMedium', '800'), styles.muted]}>
            {i + 1}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Page 5: Discover's two sections. */
function Network() {
  const { t } = useTranslation();
  const section = (title: string, photo: OnboardingPhoto, note: string) => (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('bodyMedium', '800'), styles.ink]}>
        {title}
      </Text>
      <View style={styles.row}>
        <Image source={onboardingPhotos[photo]} style={styles.avatar} contentFit="cover" accessible={false} />
        <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('bodySmall'), styles.muted]}>
          {note}
        </Text>
      </View>
    </View>
  );
  return (
    <View style={styles.card}>
      {section(t('guide.art.network'), 'selfie', t('guide.art.readBy'))}
      <View style={styles.divider} />
      {section(t('guide.art.beyond'), 'whoamiwith', t('guide.art.public'))}
    </View>
  );
}

/** The illustration for How Pickld works page 1 to 5. Decorative: the title and body say the same. */
export function GuideArt({ page }: { page: number }) {
  if (page === 1) return <IntroArt step={1} />;
  if (page === 2) return <IntroArt step={3} />;
  return (
    <View style={styles.area} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {page === 3 ? <Share /> : page === 4 ? <People /> : <Network />}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { height: sizes.introArt, justifyContent: 'center', paddingHorizontal: space.xxl },
  stack: { gap: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  radio: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.dashed },
  radioOn: { borderWidth: 6, borderColor: colors.brand },
  pill: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  thumb: { width: 44, height: 58, borderRadius: radius.thumb, backgroundColor: colors.photoPlaceholder },
  avatar: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.photoPlaceholder },
  bar: { height: 10, borderRadius: radius.pill, backgroundColor: colors.dashed, marginVertical: 3 },
  barSoft: { backgroundColor: colors.divider },
  section: { gap: space.xs, paddingVertical: space.sm },
  grow: { flex: 1 },
  ink: { color: colors.ink },
  muted: { color: colors.muted },
  onBrand: { color: colors.surface },
});
