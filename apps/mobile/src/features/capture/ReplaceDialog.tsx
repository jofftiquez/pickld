import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Dialog } from '@/components/Dialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { space, type Slot } from '@/theme/tokens';

export type ReplaceDialogProps = {
  visible: boolean;
  /** The filled slot the new photo is for. */
  slot: Slot;
  /** Replace: the new photo uploads as a replacement; the old one stays until it is live (FR-JAR-03). */
  onReplace: () => void;
  /** Keep the current photo and drop the new one. Left out where there is no new photo yet (the camera). */
  onKeep?: () => void;
  /** Cancel, a tap outside or Android back: nothing changes. */
  onClose: () => void;
  /** Cancel's label; "Cancel" by default. */
  cancelLabel?: string;
};

/** Replace dialog (M2-22, FR-JAR-03). No design: the kit's confirm Dialog with the brand button. */
export function ReplaceDialog({ visible, slot, onReplace, onKeep, onClose, cancelLabel }: ReplaceDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t('replace.title', { slot: t(`slots.${slot}`) })}
      message={t('replace.message')}
      cancelLabel={cancelLabel}
      testID="replace-dialog"
    >
      <View style={styles.actions}>
        <PrimaryButton label={t('replace.confirm')} onPress={onReplace} testID="replace-confirm" />
        {onKeep ? (
          <SecondaryButton
            label={t('replace.keep')}
            accessibilityHint={t('replace.keepHint')}
            onPress={onKeep}
            testID="replace-keep"
          />
        ) : null}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.sm },
});
