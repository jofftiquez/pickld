import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverView } from '@/features/explore/DiscoverView';
import { searchTerm } from '@/features/explore/explore';
import { useDiscoverJars, useDiscoverMoments, type DiscoverTab } from '@/features/explore/useDiscover';
import { useExplore, useExploreReading, usePeopleSearch } from '@/features/explore/useExplore';
import { useAuthStore } from '@/lib/authStore';
import { useAvatarUrls } from '@/lib/avatars';

const MINUTE = 60_000;

// The Discover tab (M6-08, D-100, D-130; FR-EXP-01 to FR-EXP-04): search people, Suggested authors, then a
// Moments | Jars switch of Everyone content from people the user doesn't read yet (D-102). The fourth tab, beside
// Jars; Find people buttons open it, and /explore links redirect here.
export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<DiscoverTab>('moments');
  // A list loads the first time its tab is shown, then stays.
  const [seenJars, setSeenJars] = useState(false);
  const explore = useExplore();
  const search = usePeopleSearch(query);
  const reading = useExploreReading();
  const moments = useDiscoverMoments(true);
  const jars = useDiscoverJars(seenJars || tab === 'jars');
  const list = tab === 'moments' ? moments : jars;
  const shown = tab === 'moments' ? moments.moments : jars.jars;
  const avatars = useAvatarUrls(
    tab === 'moments'
      ? (moments.moments ?? []).map((m) => ({ id: m.author_id, path: m.author_avatar_path }))
      : (jars.jars ?? []).map((j) => ({ id: j.author_id, path: j.author_avatar_path })),
  );
  // The spinner shows only for a pull, not for background refetches.
  const [pulling, setPulling] = useState(false);
  // "Updated 2h ago" follows the clock.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), MINUTE);
    return () => clearInterval(id);
  }, []);

  return (
    <DiscoverView
      data={explore.data}
      failed={explore.isError}
      insets={insets}
      query={query}
      onQueryChange={setQuery}
      results={search.term === null ? undefined : search.data}
      searching={searchTerm(query) !== null}
      searchFailed={search.term !== null && search.isError}
      busy={reading.busy}
      tab={tab}
      onTabChange={(next) => {
        if (next === 'jars') setSeenJars(true);
        setTab(next);
      }}
      moments={moments.moments}
      jars={jars.jars}
      listLoading={shown === undefined && !list.isError}
      listFailed={shown === undefined && list.isError}
      isRefreshing={pulling}
      isFetchingNextPage={list.isFetchingNextPage}
      viewerId={viewerId}
      avatars={avatars}
      now={now}
      onRefresh={() => {
        setPulling(true);
        setNow(new Date());
        void Promise.all([explore.refetch(), list.refresh()]).finally(() => setPulling(false));
      }}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      onRetry={() => void explore.refetch()}
      onRetryList={() => void list.refresh()}
      onOpenProfile={(username) => router.push({ pathname: '/u/[username]', params: { username } })}
      onSetReading={(person, next) => reading.setReading(person.id, next)}
      onReadAuthor={(authorId) => reading.setReading(authorId, true)}
      onOpenMoment={(m) =>
        router.push({ pathname: '/comments/[jarId]', params: { jarId: m.jar_id, momentId: m.moment_id } })
      }
      onToggleLike={moments.toggleLike}
      onOpenJar={(id) => router.push({ pathname: '/jar/[id]', params: { id } })}
    />
  );
}
