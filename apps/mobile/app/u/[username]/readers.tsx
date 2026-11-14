import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReadersView } from '@/features/profile/ReadersView';
import { useFollow } from '@/features/profile/useFollow';
import { useFollowList, type FollowList } from '@/features/profile/useFollowList';
import { useProfile } from '@/features/profile/useProfile';
import { useAvatarUrls } from '@/lib/avatars';

// /u/[username]/readers?list=readers|authors (M3-14; FR-SOC-09, FR-SOC-07): Readers & authors, from a
// profile's counts. An unknown list falls back to readers.
export default function ReadersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ username: string; list?: string }>();
  const [list, setList] = useState<FollowList>(params.list === 'authors' ? 'authors' : 'readers');
  const [query, setQuery] = useState('');
  const profile = useProfile(params.username);
  const owner = profile.data?.profile ?? null;
  const { viewerId, rows, failed, refresh } = useFollowList(owner?.id ?? null, list, query);
  const follow = useFollow(viewerId);
  // Re-signed when someone changes their photo (D-93).
  const avatars = useAvatarUrls((rows ?? []).map((r) => ({ id: r.id, path: r.avatar_path })));

  return (
    <ReadersView
      profile={profile.data === undefined ? undefined : owner}
      viewerId={viewerId}
      list={list}
      onSelectList={(next) => {
        setList(next);
        setQuery('');
      }}
      query={query}
      onChangeQuery={setQuery}
      rows={rows}
      avatars={avatars}
      failed={failed || profile.failed}
      busy={follow.busy}
      insets={insets}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: '/u/[username]', params: { username: params.username } });
      }}
      onOpenProfile={(username) => router.push({ pathname: '/u/[username]', params: { username } })}
      onFindPeople={() => router.navigate('/discover')}
      onToggleReading={(row) =>
        follow.setReading({ authorId: row.id, username: row.username, reading: !row.is_following })
      }
      onRemoveReader={(row) => follow.removeReader(row.id)}
      onRetry={() => {
        void profile.refresh();
        void refresh();
      }}
    />
  );
}
