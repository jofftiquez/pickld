import { useState } from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { MyStickersView, type RestoreState } from './MyStickersView';
import { useMyPacks, useRestorePurchases, useSavePacks } from './useMyStickers';

export type MyStickersPaneProps = {
  insets: EdgeInsets;
  /** "Get more stickers": the Stickers page switches to Shop. */
  onShop: () => void;
};

/** Mine on the Stickers page (FR-STK-08, D-61): loads and saves the packs for MyStickersView. */
export function MyStickersPane({ insets, onShop }: MyStickersPaneProps) {
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
      onRetry={() => void packs.refetch()}
      onChange={(next) => save.mutate(next)}
      onRestore={() => {
        setRestoreState({ status: 'restoring' });
        restore.mutate(undefined, {
          onSuccess: (slugs) => setRestoreState({ status: 'done', count: slugs.length }),
          onError: () => setRestoreState({ status: 'failed' }),
        });
      }}
      onShop={onShop}
    />
  );
}
