import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Dialog } from '@/components/Dialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { space } from '@/theme/tokens';

export type LeaveDraftDialogProps = {
  visible: boolean;
  /** Save draft and the busy state while it saves. */
  onSaveDraft: () => void;
  saving: boolean;
  /** Discard: the photo and its queue row are deleted. */
  onDiscard: () => void;
  /** Keep editing, a tap outside or Android back: the editor stays open. */
  onClose: () => void;
};

/**
 * Leaving the editor on a photo that isn't added yet: Save draft (kept on the phone, never uploaded, until
 * it is added) or Discard. No design: the kit's confirm Dialog with the brand button, as Replace.
 */
export function LeaveDraftDialog({ visible, onSaveDraft, saving, onDiscard, onClose }: LeaveDraftDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t('edit.leave.title')}
      message={t('edit.leave.message')}
      cancelLabel={t('edit.leave.keepEditing')}
      testID="leave-draft-dialog"
    >
      <View style={styles.actions}>
        <PrimaryButton
          label={t('edit.leave.saveDraft')}
          accessibilityHint={t('edit.leave.saveDraftHint')}
          onPress={onSaveDraft}
          disabled={saving}
          testID="leave-save-draft"
        />
        <SecondaryButton
          label={t('edit.leave.discard')}
          accessibilityHint={t('edit.leave.discardHint')}
          variant="outlineDanger"
          disabled={saving}
          onPress={onDiscard}
          testID="leave-discard"
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.sm },
});
