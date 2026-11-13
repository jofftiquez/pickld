import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseFillDateParam } from '@/features/capture/fillTarget';
import { useDayJar } from '@/features/days/useDayJar';
import { SuspensionBanner } from '@/features/jar/SuspensionBanner';
import { TodayView } from '@/features/jar/TodayView';
import { useFillPops } from '@/features/jar/useFillPops';
import { retryUpload } from '@/features/jar/retryUpload';
import { buildTodayGrid, offlineBannerCount } from '@/features/jar/todayGrid';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { JarVisibilitySheet } from '@/features/publish/JarVisibilitySheet';
import { usePublishCelebration } from '@/features/publish/publishCelebration';
import { PublishError, publishJar, type Visibility } from '@/features/publish/publishJar';
import { useIsOffline } from '@/lib/connectivity';
import { localDateIn } from '@/lib/jars';
import { getSupabase } from '@/lib/supabase';

// /day/YYYY-MM-DD: the day page (D-55; FR-DAY-02, FR-JAR-06). My days → a past day → Fill this jar opens it.
// It works like Today for that date: the same jar card and 8 tiles, built from that day's jar and the offline
// queue. An empty tile opens the camera in Fill mode (`/camera?date=&slot=`), so the server marks the moment
// "Added later" (rule 6); a filled one opens the moment preview for that day. Publish reviews that day's jar.
// Only past days have a page: today (or a future or malformed date) goes to the Today tab.
export default function DayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ date?: string }>();
  const [now] = useState(() => new Date());
  const phoneTz = phoneTimeZone();
  const date = parseFillDateParam(params.date, localDateIn(now, phoneTz));
  const { userId, day, queue, queueLoaded } = useDayJar(date);
  // The profile (readers, lid color, suspension) from Today's cached query.
  const { me } = useToday(now);
  const offline = useIsOffline();

  // Coming back (from the camera, the editor, the preview or Publish) re-reads the day, the queue and the
  // calendar behind it; the first focus is the initial load.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (userId === null) return;
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      void queryClient.invalidateQueries({ queryKey: ['day', userId] });
      void queryClient.invalidateQueries({ queryKey: ['month', userId] });
    }, [queryClient, userId]),
  );

  // A published day's visibility menu, as on Today (FR-PUB-03).
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const changeVisibility = useMutation({
    networkMode: 'always',
    mutationFn: (input: { jarId: string; visibility: Visibility }) =>
      publishJar(getSupabase(), input.jarId, input.visibility),
    onSuccess: () => {
      if (userId !== null) void queryClient.invalidateQueries({ queryKey: ['day', userId] });
      setVisibilityOpen(false);
    },
  });

  const jar = day?.jar ?? null;
  const tiles =
    date === null
      ? []
      : buildTodayGrid({ localDate: date, moments: day?.moments ?? [], queue, nowSlot: null, jarTz: jar?.tz });
  // A tile filled from here pops in with a light haptic, and Publish comes back to confetti (D-58).
  const poppingSlots = useFillPops(tiles, date !== null && day !== undefined && queueLoaded ? date : null);
  const celebratePublish = usePublishCelebration(jar?.id ?? null);

  if (date === null) return <Redirect href="/today" />;

  const tz = jar?.tz ?? phoneTz;
  const published =
    jar?.publishedAt && jar.visibility
      ? { visibility: jar.visibility, publishedAt: jar.publishedAt, likeCount: jar.likeCount ?? 0 }
      : null;

  return (
    <>
      <TodayView
        now={now}
        tz={tz}
        tiles={tiles}
        hasAnyJar
        displayName={null}
        avatarUrl={null}
        readerCount={me?.readerCount ?? null}
        lidColor={me?.lidColor}
        insets={insets}
        offlineCount={offlineBannerCount(queue, offline)}
        onCapture={(slot) => router.push({ pathname: '/camera', params: { date, slot } })}
        onRetry={(queueId) => void retryUpload(queueId)}
        suspension={
          me?.suspendedUntil !== undefined ? <SuspensionBanner until={me.suspendedUntil} tz={phoneTz} /> : null
        }
        onOpenMoment={(id) => router.push({ pathname: '/moment/[id]', params: { id } })}
        onOpenPreview={(tile) => router.push({ pathname: '/moment/preview', params: { slot: tile.slot, date } })}
        // D-55: an unpublished past jar can be published from here; a day without a jar has nothing to publish.
        onPublish={jar && !jar.publishedAt ? () => router.push({ pathname: '/publish', params: { date } }) : null}
        published={published}
        onOpenVisibility={() => {
          changeVisibility.reset();
          setVisibilityOpen(true);
        }}
        day={{ date, onBack: () => (router.canGoBack() ? router.back() : router.replace('/my-days')) }}
        poppingSlots={poppingSlots}
        celebratePublish={celebratePublish}
      />
      {published && jar ? (
        <JarVisibilitySheet
          visible={visibilityOpen}
          visibility={changeVisibility.isPending ? changeVisibility.variables.visibility : published.visibility}
          readerCount={me?.readerCount ?? null}
          busy={changeVisibility.isPending}
          error={
            changeVisibility.error
              ? changeVisibility.error instanceof PublishError
                ? changeVisibility.error.reason
                : 'failed'
              : null
          }
          onChange={(visibility) => changeVisibility.mutate({ jarId: jar.id, visibility })}
          onClose={() => setVisibilityOpen(false)}
          pastDay
        />
      ) : null}
    </>
  );
}
