import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '@/components/SecondaryButton';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

export type CameraAccessOffProps = {
  onClose: () => void;
  insets: EdgeInsets;
};

/**
 * Minimal fallback while camera permission is denied.
 * TODO(M2-08): replace with the Camera access off screen (design: CameraDenied) — Open Settings and
 * Choose from gallery instead.
 */
export function CameraAccessOff({ onClose, insets }: CameraAccessOffProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.root, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }]}
      testID="camera-access-off"
    >
      <View style={styles.body}>
        <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.text, { color: colors.surface }]}>
          {t('camera.accessOffTitle')}
        </Text>
        <Text style={[textStyle('body'), styles.text, { color: colors.onDarkMuted }]}>{t('camera.accessOffBody')}</Text>
      </View>
      <SecondaryButton label={t('common.close')} onPress={onClose} testID="camera-access-off-close" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.camera, paddingHorizontal: space.xxl, justifyContent: 'space-between' },
  body: { flex: 1, justifyContent: 'center', gap: space.md },
  text: { textAlign: 'center' },
});
