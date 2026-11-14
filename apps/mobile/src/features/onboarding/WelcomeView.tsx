import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { useLargeText } from '@/lib/useLargeText';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { onboardingPhotos, type OnboardingPhoto } from './photos';

const logo = require('../../../assets/brand/splash-logo.png');
const LOGO_ASPECT = 1200 / 496;

/** Three columns of photos, each nudged up by a different amount (Welcome). */
const COLUMNS: { offset: number; photos: OnboardingPhoto[] }[] = [
  { offset: -30, photos: ['morning', 'ootd', 'evening'] },
  { offset: -90, photos: ['selfie', 'food', 'whereami'] },
  { offset: -10, photos: ['afternoon', 'whoamiwith', 'busy'] },
];

export type WelcomeViewProps = {
  insets: EdgeInsets;
  onGetStarted: () => void;
  onSignIn: () => void;
};

/** Welcome (FR-ONB-01): a collage of real days, the promise, Get started and I already have an account. */
export function WelcomeView({ insets, onGetStarted, onSignIn }: WelcomeViewProps) {
  const { t } = useTranslation();
  const largeText = useLargeText();
  return (
    // Scrolls only when the content is taller than the screen (200% text), so Get started stays reachable.
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
      testID="welcome-screen"
    >
      <View
        style={[styles.collage, { height: largeText ? sizes.welcomeCollageLarge : sizes.welcomeCollage }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {COLUMNS.map((column, i) => (
          <View key={i} style={[styles.column, { marginTop: column.offset }]}>
            {column.photos.map((p) => (
              <Image key={p} source={onboardingPhotos[p]} style={styles.photo} contentFit="cover" accessible={false} />
            ))}
          </View>
        ))}
      </View>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        {/* React Native's Image: the white splash wordmark tinted brand green (expo-image's tint crashes on iOS). */}
        <RNImage
          source={logo}
          style={styles.logo}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('welcome.logo')}
        />
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('onboardTitle'), styles.title]}
        >
          {t('welcome.title')}
        </Text>
        <Text style={[textStyle('body'), styles.body]}>{t('welcome.body')}</Text>
        <View style={styles.spacer} />
        <PrimaryButton label={t('welcome.getStarted')} onPress={onGetStarted} testID="welcome-get-started" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('welcome.haveAccount')}
          onPress={onSignIn}
          hitSlop={hitSlopFor(undefined, 24)}
          style={styles.link}
          testID="welcome-sign-in"
        >
          <Text style={[textStyle('bodyMedium', '700'), styles.linkText]}>{t('welcome.haveAccount')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  collage: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, overflow: 'hidden' },
  column: { flex: 1, gap: space.sm },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.mosaicLarge,
    backgroundColor: colors.photoPlaceholder,
  },
  sheet: {
    flex: 1,
    marginTop: -sizes.welcomeSheetOverlap,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.xxl + 2,
    paddingHorizontal: space.xxl,
    gap: space.md,
  },
  logo: { width: sizes.welcomeLogo, height: sizes.welcomeLogo / LOGO_ASPECT, tintColor: colors.brand },
  title: { color: colors.ink, marginTop: space.xs },
  body: { color: colors.inkSoft, lineHeight: 22 },
  spacer: { flex: 1 },
  link: { alignItems: 'center', paddingVertical: space.sm + 2 },
  linkText: { color: colors.brandLink, textDecorationLine: 'underline' },
});
