import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openTodayJar } from '@/features/jar/rollover';
import { buildTodayGrid } from '@/features/jar/todayGrid';
import { phoneTimeZone, useToday } from '@/features/jar/useToday';
import { PublishError, publishJar, type Visibility } from '@/features/publish/publishJar';
import { PublishReviewView } from '@/features/publish/PublishReviewView';
import { track } from '@/lib/analytics';
import { currentSlot } from '@/lib/jars';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

// /publish (M3-01; FR-PUB-01, FR-PUB-03): review today's open jar and publish it. The choice starts on
// the profile's default visibility (Readers unless changed). Publishing needs a connection; on failure the
// screen stays with a message. Today opens it from the jar card and the Full jar celebration.
export default function PublishScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [now] = useState(() => new Date());
  const { userId, localDate, jar: jarData, me, queue } = useToday(now);
  const jar = openTodayJar(jarData, now)?.jar ?? null;
  const [choice, setChoice] = useState<Visibility | null>(null);
  const visibility = choice ?? me?.defaultVisibility ?? 'readers';

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  const publish = useMutation({
    // Fail at once offline instead of pausing until the connection returns, so the message shows.
    networkMode: 'always',
    mutationFn: (input: { jarId: string; visibility: Visibility }) =>
      publishJar(getSupabase(), input.jarId, input.visibility),
    onSuccess: (_publishedAt, input) => {
      track('jar_published', { visibility: input.visibility });
      if (userId !== null) void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
      close();
      showToast('jarPublished');
    },
  });

  // Nothing to publish before the day's first moment creates the jar.
  if (jarData !== undefined && jar === null) return <Redirect href="/today" />;

  const tz = phoneTimeZone();
  const tiles = buildTodayGrid({
    localDate: jar?.localDate ?? localDate,
    moments: jarData?.moments ?? [],
    queue,
    nowSlot: currentSlot(now, tz),
    jarTz: jar?.tz ?? null,
  });

  return (
    <PublishReviewView
      localDate={jar?.localDate ?? localDate}
      tiles={tiles}
      readerCount={me?.readerCount ?? null}
      visibility={visibility}
      onChangeVisibility={setChoice}
      busy={publish.isPending || jar === null}
      error={publish.error ? (publish.error instanceof PublishError ? publish.error.reason : 'failed') : null}
      insets={insets}
      onBack={close}
      onPublish={() => {
        if (jar !== null) publish.mutate({ jarId: jar.id, visibility });
      }}
      onNotYet={close}
    />
  );
}
