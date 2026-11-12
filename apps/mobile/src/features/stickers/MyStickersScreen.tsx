import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyStickersView, type RestoreState } from './MyStickersView';
import { useMyPacks, useRestorePurchases, useSavePacks } from './useMyStickers';

/** /stickers/mine (FR-STK-08): opened from Settings → My stickers. */
export function MyStickersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const packs = useMyPacks();
  const save = useSavePacks();
  const restore = useRestorePurchases();
  const [restoreState, setRestoreState] = useState<RestoreState>({ status: 'idle' });
  return (
    <MyStickersView
      packs={packs.data}
      failed={packs.isError}
      saveFailed={save.isError}
      restore={restoreState}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onRetry={() => void packs.refetch()}
      onChange={(next) => save.mutate(next)}
      onRestore={() => {
        setRestoreState({ status: 'restoring' });
        restore.mutate(undefined, {
          onSuccess: (slugs) => setRestoreState({ status: 'done', count: slugs.length }),
          onError: () => setRestoreState({ status: 'failed' }),
        });
      }}
      onShop={() => router.push('/stickers/shop')}
    />
  );
}
