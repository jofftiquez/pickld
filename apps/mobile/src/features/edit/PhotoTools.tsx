import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { RoundIconButton } from '@/components/RoundIconButton';
import { colors, space } from '@/theme/tokens';

export type PhotoToolsProps = {
  /** A changed photo is being made: the buttons wait for it. */
  busy: boolean;
  /** Turned off until the photo is ready to change (a just-taken photo still being prepared). */
  disabled?: boolean;
  /** Left out for a photo framed by Fit: a quarter turn would cut the frame's sides away. */
  onRotate?: () => void;
  onFlip: () => void;
  /** Opens Crop on the photo as it looks now; left out where the photo can't be re-cropped here. */
  onCrop?: () => void;
};

/**
 * The editor's quick photo buttons (FR-CAP-04), down the photo's top right corner: turn it a quarter turn,
 * mirror it, and open Crop. A camera photo skips Crop, so these are how it gets fixed in the editor.
 */
export function PhotoTools({ busy, disabled = false, onRotate, onFlip, onCrop }: PhotoToolsProps) {
  const { t } = useTranslation();
  const off = busy || disabled;
  return (
    <View style={styles.column} testID="editor-photo-tools">
      {onRotate ? (
        <RoundIconButton
          icon="rotateRight"
          variant="glass"
          accessibilityLabel={t('edit.adjust.rotate')}
          accessibilityHint={t('edit.adjust.rotateHint')}
          disabled={off}
          onPress={onRotate}
          testID="editor-rotate"
        />
      ) : null}
      <RoundIconButton
        icon="mirror"
        variant="glass"
        accessibilityLabel={t('edit.adjust.flip')}
        accessibilityHint={t('edit.adjust.flipHint')}
        disabled={off}
        onPress={onFlip}
        testID="editor-flip"
      />
      {onCrop ? (
        <RoundIconButton
          icon="crop"
          variant="glass"
          accessibilityLabel={t('edit.adjust.crop')}
          accessibilityHint={t('edit.adjust.cropHint')}
          disabled={off}
          onPress={onCrop}
          testID="editor-crop"
        />
      ) : null}
      {busy ? <ActivityIndicator color={colors.surface} accessibilityLabel={t('edit.adjust.working')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', top: space.md, right: space.md, gap: space.sm, alignItems: 'center' },
});
