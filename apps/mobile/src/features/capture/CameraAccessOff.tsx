import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type CameraAccessOffProps = {
  insets: EdgeInsets;
  onClose: () => void;
  onOpenSettings: () => void;
  onChooseFromGallery: () => void;
};

/**
 * Camera access off (FR-CAP-11; design: CameraDenied): camera permission is denied or restricted, so
 * offer Settings or the gallery instead. Scrolls when large text makes it taller than the screen.
 */
export function CameraAccessOff({ insets, onClose, onOpenSettings, onChooseFromGallery }: CameraAccessOffProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const closeTop = insets.top + space.xxl;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} testID="camera-access-off" bounces={false}>
      <View
        style={[
          styles.panel,
          {
            minHeight: window.height * sizes.accessOffPanel,
            paddingTop: closeTop + sizes.roundButton + space.md,
          },
        ]}
      >
        <View style={styles.message}>
          <View style={styles.iconWell}>
            <Icon name="cameraOff" color="surface" size={34} strokeWidth={1.8} />
          </View>
          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.text, { color: colors.surface }]}>
            {t('cameraAccessOff.title')}
          </Text>
          <Text style={[textStyle('bodyMedium'), styles.text, styles.body]}>{t('cameraAccessOff.body')}</Text>
        </View>
        <View style={[styles.close, { top: closeTop }]}>
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            testID="camera-access-off-close"
          />
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xxl }]}>
        <PrimaryButton
          label={t('cameraAccessOff.openSettings')}
          accessibilityHint={t('cameraAccessOff.openSettingsHint')}
          onPress={onOpenSettings}
          testID="camera-access-off-settings"
        />
        <SecondaryButton
          variant="onDark"
          label={t('cameraAccessOff.gallery')}
          accessibilityHint={t('cameraAccessOff.galleryHint')}
          onPress={onChooseFromGallery}
          testID="camera-access-off-gallery"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.camera },
  content: { flexGrow: 1 },
  panel: {
    backgroundColor: colors.cameraPanel,
    borderBottomLeftRadius: radius.viewfinder,
    borderBottomRightRadius: radius.viewfinder,
    justifyContent: 'center',
    paddingBottom: space.xxl,
  },
  message: { alignItems: 'center', gap: space.md + 2, paddingHorizontal: space.xxxl + space.md },
  iconWell: {
    width: sizes.accessOffIconWell,
    height: sizes.accessOffIconWell,
    borderRadius: radius.tile,
    backgroundColor: colors.onDarkWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center' },
  body: { color: colors.onDarkMuted },
  close: { position: 'absolute', left: space.lg },
  actions: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: space.sm,
    paddingTop: space.xxl,
    paddingHorizontal: space.xxl,
  },
});
