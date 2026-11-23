import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TogetherView } from '@/features/profile/TogetherView';
import { useProfile } from '@/features/profile/useProfile';
import { useTogetherPage } from '@/features/profile/useTogetherPage';

// /u/[username]/together (0176): the profile's Together page, from the Together row on the profile.
export default function TogetherScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const profile = useProfile(username);
  const owner = profile.data?.profile ?? null;
  const page = useTogetherPage(owner?.id ?? null);

  return (
    <TogetherView
      profile={profile.data === undefined ? undefined : owner}
      viewerId={page.viewerId}
      moments={page.data}
      failed={page.failed || profile.failed}
      insets={insets}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: '/u/[username]', params: { username } });
      }}
      onOpenMoment={(momentId, jarId) =>
        router.push({ pathname: '/moment/[id]', params: { id: momentId, jar: jarId } })
      }
      onRetry={() => {
        void profile.refresh();
        void page.refresh();
      }}
    />
  );
}
