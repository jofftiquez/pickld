import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentsFeedView } from '@/features/moments/MomentsFeedView';
import { useMomentsFeed } from '@/features/moments/useMomentsFeed';
import { useTimelineJump } from '@/features/scrubber/useTimelineJump';
import { useUnreadNotifications } from '@/features/notifications/useNotifications';
import { useAvatarUrls } from '@/lib/avatars';

// Moments tab (QA round 1, piece 5; FR-SOC-01, FR-SOC-02, D-52, D-53): live moments from people the user
// reads and their own, newest first. A card opens the moment's thread; Go to jar opens its jar (D-94).
export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The date scrubber's jump (FR-SOC-01): the timeline starts at that day and pages both ways from it.
  const jump = useTimelineJump('moments');
  const feed = useMomentsFeed(jump.from);
  const unread = useUnreadNotifications();
  const { userId } = feed;
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
      key={jump.viewKey}
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
        unread.refresh();
        jump.refetchDays();
        // Pulling at the top of a jumped-to day goes back to the newest moments.
        if (jump.jumped) return jump.clearJump();
        setPulling(true);
        void feed.refresh().finally(() => setPulling(false));
      }}
      onBackToTop={(mode) => {
        if (jump.jumped) jump.clearJump();
        else if (mode === 'reload') void feed.refresh();
      }}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      scrubber={jump.scrubber}
      isFetchingPreviousPage={feed.isFetchingPreviousPage}
      onStartReached={() => {
        if (feed.hasPreviousPage && !feed.isFetchingPreviousPage) feed.fetchPreviousPage();
      }}
      onOpenNotifications={() => router.push('/notifications')}
      onOpenJar={(m) => router.push({ pathname: '/jar/[id]', params: { id: m.jar_id } })}
      onToggleLike={feed.toggleLike}
      onOpenComments={(m) =>
        router.push({ pathname: '/comments/[jarId]', params: { jarId: m.jar_id, momentId: m.moment_id } })
      }
      onFindPeople={() => router.navigate('/discover')}
      onInvite={() => router.push('/invite')}
    />
  );
}
