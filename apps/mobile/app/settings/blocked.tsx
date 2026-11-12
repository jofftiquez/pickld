import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBlock, useBlockedAccounts } from '@/features/safety/block';
import { BlockedView } from '@/features/safety/BlockedView';

// /settings/blocked (M3-22; FR-PUB-06): Blocked accounts, opened from Settings.
export default function BlockedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rows, failed, refresh } = useBlockedAccounts();
  const { unblock, busy } = useBlock();
  return (
    <BlockedView
      rows={rows}
      failed={failed}
      busy={busy}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onUnblock={(row) => unblock(row.id)}
      onRetry={() => void refresh()}
    />
  );
}
