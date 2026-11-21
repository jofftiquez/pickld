import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isThreeByFour } from '@/features/capture/cropMath';
import { fillTarget, parseFillDateParam } from '@/features/capture/fillTarget';
import { parseDevPhotoParam, pickDevPhoto } from '@/features/capture/mockCamera';
import { usePendingCrop } from '@/features/capture/pendingCrop';
import { galleryTarget, saveGalleryPhoto } from '@/features/capture/saveCapture';
import { useGalleryPicker } from '@/features/capture/useGalleryPicker';
import { nextDay, stepToday } from '@/features/days/pastDay';
import { useDayJar } from '@/features/days/useDayJar';
import { SuspensionBanner } from '@/features/jar/SuspensionBanner';
import { TodayView } from '@/features/jar/TodayView';
import { openTodayJar } from '@/features/jar/rollover';
import { useFillPops } from '@/features/jar/useFillPops';
import { retryUpload } from '@/features/jar/retryUpload';
import { buildTodayGrid, offlineBannerCount } from '@/features/jar/todayGrid';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { JarVisibilitySheet } from '@/features/publish/JarVisibilitySheet';
import { usePublishCelebration } from '@/features/publish/publishCelebration';
import { PublishError, publishJar, type Visibility } from '@/features/publish/publishJar';
import { useIsOffline } from '@/lib/connectivity';
import { addDays, localDateIn } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { getSupabase } from '@/lib/supabase';
import type { Slot } from '@/theme/tokens';

// /day/YYYY-MM-DD: the day page (D-55; FR-DAY-02, FR-JAR-06). Tapping a past date in My days (or Go to a
// date) opens it (D-153). It works like Today for that date: the same jar card and 8 tiles, built from that
// day's jar and the offline queue. A past day is filled from the gallery only, never the camera (D-153): an
// empty tile opens the in-app gallery on "Only <that day>" (asking for Photos access once while undecided;
// without access, Apple's picker), and the photo goes into that day's jar for the tapped slot, through Crop
// when it isn't 3:4, then the editor, which comes back here. The server marks it "Added later" (rule 6) and
// refuses a slot taken meanwhile (a conflict, never an overwrite). A filled tile opens the moment preview for
// that day; Publish reviews that day's jar, and a published one has View jar. Only past days have a page:
// today (or a future or malformed date) goes to the Today tab. Dev-only `?devPhoto=` picks a bundled photo
// instead of the gallery, as on the camera, so Maestro can fill a day. A past day looks like one (D-156): warm
// paper, and a banner naming the day with Back to Today, so it is never mistaken for Today.
export default function DayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ date?: string; devPhoto?: string }>();
  const [now] = useState(() => new Date());
  const phoneTz = phoneTimeZone();
  const phoneToday = localDateIn(now, phoneTz);
  const date = parseFillDateParam(params.date, phoneToday);
  const { userId, day, queue, queueLoaded } = useDayJar(date);
  // The profile (readers, lid color, suspension) and today's jar from Today's cached query.
  const { me, jar: todayJar } = useToday(now);
  const offline = useIsOffline();

  // Coming back (from Crop, the editor, the preview or Publish) re-reads the day, the queue and the
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

  // An empty tile: a photo from the gallery for that day and slot, as the camera's gallery button saves one.
  const gallery = useGalleryPicker({ tz: phoneTz, target: date, insets, askOnce: true });
  const devPhoto = parseDevPhotoParam(params.devPhoto, __DEV__);
  const setPendingCrop = usePendingCrop((s) => s.setPending);
  const [busy, setBusy] = useState(false);
  const onFill = async (slot: Slot) => {
    if (busy || date === null || userId === null) return;
    setBusy(true);
    try {
      const photo = devPhoto ? await pickDevPhoto(devPhoto) : await gallery.pick();
      if (photo === null) return;
      const fill = fillTarget(date, jar, phoneTz);
      const target = galleryTarget({ exif: photo.exif, tz: phoneTz, now: new Date(), openJar: null, fill });
      if (!isThreeByFour(photo)) {
        setPendingCrop({ photo, slot, userId, target });
        router.push('/crop');
        return;
      }
      const visibility = me?.defaultVisibility ?? null; // D-48: a new moment starts at the owner's default
      const item = await saveGalleryPhoto({
        uri: photo.uri,
        slot,
        userId,
        target,
        crop: null,
        visibility,
        exif: photo.exif,
      });
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      router.push(`/edit/${item.id}`);
    } catch (error) {
      captureError(error, { area: 'gallery' });
    } finally {
      setBusy(false);
    }
  };

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
        coverMomentId={jar?.coverMomentId ?? null}
        hasAnyJar
        displayName={null}
        avatarUrl={null}
        readerCount={me?.readerCount ?? null}
        lidColor={me?.lidColor}
        insets={insets}
        offlineCount={offlineBannerCount(queue, offline)}
        onCapture={(slot) => void onFill(slot)}
        onRetry={(queueId) => void retryUpload(queueId)}
        suspension={
          me?.suspendedUntil !== undefined ? <SuspensionBanner until={me.suspendedUntil} tz={phoneTz} /> : null
        }
        onOpenMoment={(id) => router.push({ pathname: '/moment/[id]', params: { id } })}
        onOpenDraft={(queueId) => router.push(`/edit/${queueId}`)}
        onOpenPreview={(tile) => router.push({ pathname: '/moment/preview', params: { slot: tile.slot, date } })}
        // D-55: an unpublished past jar can be published from here; a day without a jar has nothing to publish.
        onPublish={jar && !jar.publishedAt ? () => router.push({ pathname: '/publish', params: { date } }) : null}
        published={published}
        onOpenVisibility={() => {
          changeVisibility.reset();
          setVisibilityOpen(true);
        }}
        day={{
          date,
          onBack: () => (router.canGoBack() ? router.back() : router.replace('/my-days')),
          // D-156: the past-day banner's Back to Today, past My days and any other day below.
          onBackToToday: () => router.dismissTo('/today'),
          // D-153: in place of the removed My days card's link.
          onViewJar:
            published && jar ? () => router.push({ pathname: '/jar/[id]', params: { id: jar.id } }) : undefined,
        }}
        poppingSlots={poppingSlots}
        celebratePublish={celebratePublish}
        // Joff: step a day at a time on this page, so Back still leads where it came from; the day after
        // the last past day is Today (its jar's own date).
        step={{
          previous: addDays(date, -1),
          next: nextDay(date, stepToday(openTodayJar(todayJar, now)?.jar?.localDate ?? phoneToday, phoneToday)),
          onStep: (to) => (to === 'today' ? router.dismissTo('/today') : router.setParams({ date: to })),
        }}
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
      {gallery.modal}
    </>
  );
}
