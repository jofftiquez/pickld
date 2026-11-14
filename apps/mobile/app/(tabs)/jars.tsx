import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedView } from '@/features/feed/FeedView';
import { useFeed } from '@/features/feed/useFeed';
import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { useTimelineJump } from '@/features/scrubber/useTimelineJump';
import { useUnreadNotifications } from '@/features/notifications/useNotifications';
import { useAvatarUrls } from '@/lib/avatars';

const MINUTE = 60_000;

// Jars tab (M3-04; FR-SOC-01, NFR-PERF-02, NFR-OFF-03): published jars from followed authors, newest first.
export default function JarsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The date scrubber's jump (FR-SOC-01): the feed starts at that day and pages both ways from it.
  const jump = useTimelineJump('jars');
  const feed = useFeed(jump.from);
  const unread = useUnreadNotifications();
  const { userId, markSeen } = feed;
  const me = useQuery({
    queryKey: todayQueryKeys.me(userId ?? ''),
    queryFn: () => fetchMe(userId ?? ''),
    enabled: userId !== null,
  });
  // Signed avatars for the avatar row and the cards, re-signed when someone changes their photo (D-93).
  const avatars = useAvatarUrls([
    ...(feed.authors ?? []).map((a) => ({ id: a.author_id, path: a.avatar_path })),
    ...(feed.jars ?? []).map((j) => ({ id: j.author_id, path: j.author_avatar_path })),
  ]);
  // The spinner shows only for a pull, not for background refetches (focus, reconnect, app start).
  const [pulling, setPulling] = useState(false);
  // "Updated 2h ago" follows the clock.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), MINUTE);
    return () => clearInterval(id);
  }, []);
  // Leaving the tab marks what was on screen as seen; the rings change on the next visit.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      unread.refresh();
      return () => {
        if (userId !== null) markSeen();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- markSeen and unread.refresh are new functions each render
    }, [userId]),
  );

  return (
    <FeedView
      key={jump.viewKey}
      jars={feed.jars}
      authors={feed.authors}
      myName={me.data?.displayName ?? null}
      myAvatarUrl={me.data?.avatarUrl ?? null}
      avatars={avatars}
      now={now}
      insets={insets}
      isLoading={feed.isLoading}
      isRefreshing={pulling}
      isFetchingNextPage={feed.isFetchingNextPage}
      hasUnread={unread.hasUnread}
      onRefresh={() => {
        unread.refresh();
        jump.refetchDays();
        // Pulling at the top of a jumped-to day goes back to the newest jars.
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
      onOpenJar={(jarId) => router.push({ pathname: '/jar/[id]', params: { id: jarId } })}
      onOpenProfile={(username) => {
        const name = username ?? me.data?.username;
        if (name) router.push({ pathname: '/u/[username]', params: { username: name } });
      }}
      onFindPeople={() => router.navigate('/discover')}
      onInvite={() => router.push('/invite')}
    />
  );
}
