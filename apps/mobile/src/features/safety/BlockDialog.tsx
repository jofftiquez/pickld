import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';

export type BlockDialogProps = {
  visible: boolean;
  /** Who would be blocked, e.g. "Mika Reyes". */
  name: string;
  avatarUrl?: string | null;
  busy?: boolean;
  onBlock: () => void;
  onClose: () => void;
};

/** Block confirmation (Block; FR-SAF-02): what blocking does, Block, Cancel. Nobody is told. */
export function BlockDialog({ visible, name, avatarUrl, busy = false, onBlock, onClose }: BlockDialogProps) {
  const { t } = useTranslation();
  const firstName = name.trim().split(/\s+/)[0] ?? name;
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t('block.title', { name })}
      message={t('block.message', { name: firstName })}
      media={<Avatar name={name} uri={avatarUrl} size="lg" decorative />}
      testID="block-dialog"
    >
      <DangerButton label={t('block.confirm')} onPress={onBlock} disabled={busy} testID="block-confirm" />
    </Dialog>
  );
}
