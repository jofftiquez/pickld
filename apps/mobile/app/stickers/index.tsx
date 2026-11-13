import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StickersHome } from '@/features/stickers/StickersHome';
import { stickersTabFrom } from '@/features/stickers/stickersTab';

// /stickers (QA item 20, D-61; FR-STK-06, FR-STK-08): the Stickers page, Mine | Shop. `?tab=shop` opens Shop;
// a missing or unknown tab opens Mine. Opened from Today's header, your profile, Settings and the editor.
export default function StickersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  return (
    <StickersHome
      initialTab={stickersTabFrom(params)}
      insets={insets}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onOpenPack={(pack) => router.push({ pathname: '/stickers/pack/[slug]', params: { slug: pack.slug } })}
    />
  );
}
