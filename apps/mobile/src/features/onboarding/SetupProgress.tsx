import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, radius, sizes, space } from '@/theme/tokens';

/** Setup steps with a progress bar: About you, Your day, People, Jar lid, Permissions, Friends. */
export const SETUP_STEPS = 6;

/** The segmented bar at the top of each setup screen (About … Friends). */
export function SetupProgress({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('setup.step', { step, count: SETUP_STEPS })}
      accessibilityValue={{ min: 0, max: SETUP_STEPS, now: step }}
      testID="setup-progress"
    >
      {Array.from({ length: SETUP_STEPS }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < step ? colors.brand : colors.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  segment: { flex: 1, height: sizes.setupStep, borderRadius: radius.pill },
});
