import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseFillDateParam } from '@/features/capture/fillTarget';
import { useDayJar } from '@/features/days/useDayJar';
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
// `?date=YYYY-MM-DD` (a past day) reviews that day's jar instead: the day page opens it (D-55, FR-DAY-02).
// Either way it goes back to where it was opened from.
export default function PublishScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ date?: string }>();
  const [now] = useState(() => new Date());
  const { userId, localDate, jar: jarData, me, queue } = useToday(now);
  // Deep links are untrusted: only a real past date picks a past jar; anything else is today's open jar.
  const pastDate = parseFillDateParam(params.date, localDate);
  const { day } = useDayJar(pastDate);
  const jar = pastDate ? (day?.jar ?? null) : (openTodayJar(jarData, now)?.jar ?? null);
  const loaded = pastDate ? day !== undefined : jarData !== undefined;
  const moments = (pastDate ? day?.moments : jarData?.moments) ?? [];
  const [choice, setChoice] = useState<Visibility | null>(null);
  const visibility = choice ?? me?.defaultVisibility ?? 'readers';

  const home = pastDate ? `/day/${pastDate}` : '/today';
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(home);
  };

  const publish = useMutation({
    // Fail at once offline instead of pausing until the connection returns, so the message shows.
    networkMode: 'always',
    mutationFn: (input: { jarId: string; visibility: Visibility }) =>
      publishJar(getSupabase(), input.jarId, input.visibility),
    onSuccess: (_publishedAt, input) => {
      track('jar_published', { visibility: input.visibility });
      if (userId !== null) {
        void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
        void queryClient.invalidateQueries({ queryKey: ['day', userId] });
      }
      close();
      showToast('jarPublished');
    },
  });

  // Nothing to publish before the day's first moment creates the jar.
  if (loaded && jar === null) return <Redirect href={home} />;

  const tz = phoneTimeZone();
  const jarDate = jar?.localDate ?? pastDate ?? localDate;
  const tiles = buildTodayGrid({
    localDate: jarDate,
    moments,
    queue,
    nowSlot: pastDate ? null : currentSlot(now, tz),
    jarTz: jar?.tz ?? null,
  });

  return (
    <PublishReviewView
      localDate={jarDate}
      pastDay={pastDate !== null}
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
