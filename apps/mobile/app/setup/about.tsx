import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

// About you. New accounts land here after signing up; M4-04 (#94) builds the form.
export default function AboutRoute() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.xxxl }]} testID="setup-about">
      <Text accessibilityRole="header" style={[textStyle('onboardTitle'), { color: colors.ink }]}>
        {t('setup.about.title')}
      </Text>
      <Text style={[textStyle('body'), { color: colors.inkSoft }]}>{t('setup.about.body')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space.xxl, gap: space.md },
});
