import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedView } from '@/features/feed/FeedView';
import { useFeed } from '@/features/feed/useFeed';
import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { profileUrl } from '@/lib/links';

const MINUTE = 60_000;

// Jars tab (M3-04; FR-SOC-01, NFR-PERF-02, NFR-OFF-03): published jars from followed authors, newest first.
export default function JarsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const feed = useFeed();
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
      return () => {
        if (userId !== null) markSeen();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- markSeen is a new function each render
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
      // TODO(M3-19): unread notifications and the Notifications screen.
      hasUnread={false}
      onRefresh={() => {
        setPulling(true);
        void feed.refresh().finally(() => setPulling(false));
      }}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      onOpenNotifications={() => undefined}
      // TODO(M3-07): open the Jar page.
      // TODO(M4-08): open Find friends (D-5); it doesn't exist yet.
      onFindPeople={() => undefined}
      onInvite={() => {
        const username = me.data?.username;
        if (username) void Share.share({ message: t('feed.inviteMessage', { url: profileUrl(username) }) });
      }}
    />
  );
}
