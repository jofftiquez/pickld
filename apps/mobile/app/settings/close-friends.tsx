import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCloseFriends } from '@/features/settings/closeFriends';
import { CloseFriendsView } from '@/features/settings/CloseFriendsView';
import { useAvatarUrls } from '@/lib/avatars';

// /settings/close-friends (0179): Close friends, opened from Settings.
export default function CloseFriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { rows, ids, count, failed, failedSave, toggle, refresh } = useCloseFriends(query);
  // Re-signed when someone changes their photo (D-93).
  const avatars = useAvatarUrls((rows ?? []).map((r) => ({ id: r.id, path: r.avatar_path })));
  return (
    <CloseFriendsView
      rows={rows}
      ids={ids}
      count={count}
      query={query}
      onChangeQuery={setQuery}
      avatars={avatars}
      failed={failed}
      failedSave={failedSave}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onToggle={(row, on) => toggle(row.id, on)}
      onRetry={() => void refresh()}
    />
  );
}
