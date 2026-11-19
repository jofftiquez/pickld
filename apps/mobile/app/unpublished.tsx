import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UnpublishedView } from '@/features/days/UnpublishedView';
import { unpublishedQueryKeys, useUnpublishedJars } from '@/features/days/useUnpublishedJars';

// /unpublished (FR-DAY-02, FR-PUB-01): Not published, the past week's days that hold moments but weren't
// published or kept to myself. Opened from the Not published row on My jars. Publish opens that day's review;
// a row opens its day page.
export default function UnpublishedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { userId, jars, keep, keepFailed } = useUnpublishedJars();

  // Coming back from Publish or a day page re-reads the list; the first focus is the initial load.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (userId !== null) void queryClient.invalidateQueries({ queryKey: unpublishedQueryKeys.list(userId) });
    }, [queryClient, userId]),
  );

  return (
    <UnpublishedView
      jars={jars}
      insets={insets}
      keepFailed={keepFailed}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/my-days'))}
      onOpen={(jar) => router.push({ pathname: '/day/[date]', params: { date: jar.localDate } })}
      onPublish={(jar) => router.push({ pathname: '/publish', params: { date: jar.localDate } })}
      onKeep={keep}
    />
  );
}
