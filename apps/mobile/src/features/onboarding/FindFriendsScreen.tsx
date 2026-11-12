import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { setReading } from '@/features/profile/useFollow';
import { useAuthStore } from '@/lib/authStore';
import { profileUrl } from '@/lib/links';

import { hashAddressBook, matchContacts, type FriendMatch } from './findFriends';
import { FindFriendsView, type FindState } from './FindFriendsView';
import { nextSetupRoute, saveSetupStep } from './setupFlow';

export type FindFriendsDeps = {
  hashAddressBook: typeof hashAddressBook;
  matchContacts: typeof matchContacts;
};
const defaultDeps: FindFriendsDeps = { hashAddressBook, matchContacts };

/**
 * Find friends: Find asks for contacts (the system prompt follows the reason on the card), hashes them on
 * the phone and lists the matches; Read follows at once (optimistic, reverted on failure). The invite link
 * opens the share sheet. Continue and Skip for now both finish this step.
 */
export function FindFriendsScreen({ deps = defaultDeps }: { deps?: FindFriendsDeps }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const me = useQuery({
    queryKey: todayQueryKeys.me(userId ?? ''),
    queryFn: () => fetchMe(userId ?? ''),
    enabled: !!userId,
  });
  const [state, setState] = useState<FindState>('idle');
  const [matches, setMatches] = useState<FriendMatch[]>([]);

  const username = me.data?.username;
  const url = username ? profileUrl(username) : '';
  const link = url.replace(/^https:\/\//, '');

  const onFind = async () => {
    setState('finding');
    try {
      const hashes = await deps.hashAddressBook();
      if (hashes === 'denied') {
        setState('denied');
        return;
      }
      setMatches(await deps.matchContacts(hashes));
      setState('matched');
    } catch {
      setState('failed');
    }
  };

  const onRead = async (match: FriendMatch) => {
    if (!userId) return;
    const reading = !match.reading;
    const flip = (value: boolean) =>
      setMatches((list) => list.map((m) => (m.id === match.id ? { ...m, reading: value } : m)));
    flip(reading);
    try {
      await setReading(userId, match.id, reading);
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch {
      flip(!reading);
    }
  };

  const finish = async () => {
    if (!userId) return;
    const next = nextSetupRoute('/setup/friends');
    await saveSetupStep(userId, next);
    if (next) router.push(next);
    else router.replace('/');
  };

  return (
    <FindFriendsView
      insets={insets}
      link={link}
      state={state}
      matches={matches}
      onFind={() => void onFind()}
      onOpenSettings={() => void Linking.openSettings()}
      onInvite={() => {
        if (url) void Share.share({ message: t('setup.friends.shareMessage', { link: url }) });
      }}
      onRead={(m) => void onRead(m)}
      onContinue={() => void finish()}
      onSkip={() => void finish()}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
