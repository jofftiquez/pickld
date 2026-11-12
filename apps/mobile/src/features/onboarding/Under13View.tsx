import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { JarGraphic } from '@/components/JarGraphic';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

export type Under13ViewProps = { insets: EdgeInsets; onBackToStart: () => void };

/** Under 13 (FR-ACC-04): shown after fn:account-purge removed everything; nothing about the attempt is kept. */
export function Under13View({ insets, onBackToStart }: Under13ViewProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }]}
      testID="under13-screen"
    >
      <RoundIconButton icon="back" accessibilityLabel={t('setup.back')} onPress={onBackToStart} testID="under13-back" />
      <View style={styles.middle}>
        <JarGraphic count={0} size={sizes.under13Jar} decorative />
        <Text accessibilityRole="header" style={[textStyle('onboardTitle'), styles.center, { color: colors.ink }]}>
          {t('setup.under13.title')}
        </Text>
        <Text style={[textStyle('body'), styles.center, styles.body]}>{t('setup.under13.body')}</Text>
      </View>
      <SecondaryButton
        variant="outline"
        label={t('setup.under13.back')}
        onPress={onBackToStart}
        testID="under13-start"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space.xxl },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingBottom: sizes.under13Jar * 2,
  },
  center: { textAlign: 'center' },
  body: { color: colors.inkSoft, lineHeight: 23 },
});
