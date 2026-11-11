import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StickerUnlockedView } from '@/features/jar/StickerUnlockedView';
import { stickerUnlockedParams } from '@/features/jar/useCelebrations';
import { useReduceMotion } from '@/lib/useReduceMotion';

// /sticker-unlocked (M2-28; FR-STK-05): a newly earned milestone sticker. Today opens it once per
// milestone, after the Full jar celebration (useCelebrations); a bad link goes to Today.
export default function StickerUnlockedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const reduceMotion = useReduceMotion();
  const parsed = stickerUnlockedParams.safeParse(params);
  if (!parsed.success) return <Redirect href="/today" />;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };
  return (
    <StickerUnlockedView
      milestone={parsed.data.key}
      earned={parsed.data.earned}
      reduceMotion={reduceMotion}
      insets={insets}
      onClose={close}
    />
  );
}
