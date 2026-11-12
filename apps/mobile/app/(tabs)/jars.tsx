import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedView } from '@/features/feed/FeedView';
import { useFeed } from '@/features/feed/useFeed';
import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { useUnreadNotifications } from '@/features/notifications/useNotifications';
import { profileUrl } from '@/lib/links';

const MINUTE = 60_000;

// Jars tab (M3-04; FR-SOC-01, NFR-PERF-02, NFR-OFF-03): published jars from followed authors, newest first.
export default function JarsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const feed = useFeed();
  const unread = useUnreadNotifications();
  const { userId, markSeen } = feed;
  const me = useQuery({
    queryKey: todayQueryKeys.me(userId ?? ''),
    queryFn: () => fetchMe(userId ?? ''),
    enabled: userId !== null,
  });
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
      jars={feed.jars}
      authors={feed.authors}
      myName={me.data?.displayName ?? null}
      now={now}
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
      onOpenJar={(jarId) => router.push({ pathname: '/jar/[id]', params: { id: jarId } })}
      onOpenProfile={(username) => {
        const name = username ?? me.data?.username;
        if (name) router.push({ pathname: '/u/[username]', params: { username: name } });
      }}
      // TODO(M4-08): open Find friends (D-5); it doesn't exist yet.
      onFindPeople={() => undefined}
      onInvite={() => {
        const username = me.data?.username;
        if (username) void Share.share({ message: t('feed.inviteMessage', { url: profileUrl(username) }) });
      }}
    />
  );
}
