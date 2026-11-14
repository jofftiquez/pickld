import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { MomentsFeedView } from '@/features/moments/MomentsFeedView';
import { useMomentsFeed } from '@/features/moments/useMomentsFeed';
import { useUnreadNotifications } from '@/features/notifications/useNotifications';
import { useAvatarUrls } from '@/lib/avatars';
import { profileUrl } from '@/lib/links';

// Moments tab (QA round 1, piece 5; FR-SOC-01, FR-SOC-02, D-52, D-53): live moments from people the user
// reads and their own, newest first. A card opens the moment's thread; Go to jar opens its jar (D-94).
export default function MomentsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const feed = useMomentsFeed();
  const unread = useUnreadNotifications();
  const { userId } = feed;
  const me = useQuery({
    queryKey: todayQueryKeys.me(userId ?? ''),
    queryFn: () => fetchMe(userId ?? ''),
    enabled: userId !== null,
  });
  // Re-signed when someone changes their photo (D-93).
  const avatars = useAvatarUrls((feed.moments ?? []).map((m) => ({ id: m.author_id, path: m.author_avatar_path })));
  // The spinner shows only for a pull, not for background refetches.
  const [pulling, setPulling] = useState(false);
  useFocusEffect(
    useCallback(() => {
      unread.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- unread.refresh is a new function each render
    }, [userId]),
  );

  return (
    <MomentsFeedView
      moments={feed.moments}
      authors={feed.authors}
      viewerId={userId}
      avatars={avatars}
      insets={insets}
      isLoading={feed.isLoading}
      isRefreshing={pulling}
      isFetchingNextPage={feed.isFetchingNextPage}
      hasUnread={unread.hasUnread}
      onRefresh={() => {
        setPulling(true);
        unread.refresh();
        void feed.refresh().finally(() => setPulling(false));
      }}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      onOpenNotifications={() => router.push('/notifications')}
      onOpenJar={(m) => router.push({ pathname: '/jar/[id]', params: { id: m.jar_id } })}
      onToggleLike={feed.toggleLike}
      onOpenComments={(m) =>
        router.push({ pathname: '/comments/[jarId]', params: { jarId: m.jar_id, momentId: m.moment_id } })
      }
      onFindPeople={() => router.push('/explore')}
      onInvite={() => {
        const username = me.data?.username;
        if (username) void Share.share({ message: t('feed.inviteMessage', { url: profileUrl(username) }) });
      }}
    />
  );
}
