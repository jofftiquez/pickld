import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConflictReplacePrompt } from '@/features/capture/ConflictReplacePrompt';
import { DayLine } from '@/features/jar/DayLine';
import { ensureLineJar, useSaveJarLine } from '@/features/jar/jarLine';
import { SuspensionBanner } from '@/features/jar/SuspensionBanner';
import { TimeZoneBanner } from '@/features/jar/TimeZoneBanner';
import { TodayView } from '@/features/jar/TodayView';
import { GuideTip } from '@/features/guide/GuideTip';
import { useGuideTip } from '@/features/guide/useGuideTip';
import { useFeaturedPack } from '@/features/stickers/featuredPack';
import { retryUpload } from '@/features/jar/retryUpload';
import { openTodayJar, useRollover } from '@/features/jar/rollover';
import { buildTodayGrid, holdsSlot, offlineBannerCount } from '@/features/jar/todayGrid';
import { useCelebrations } from '@/features/jar/useCelebrations';
import { useFillPops } from '@/features/jar/useFillPops';
import { DAY_SLOTS } from '@/features/reminders/reminderPlan';
import { useReminderSync } from '@/features/reminders/useReminderSync';
import { useWidgetSync } from '@/features/widgets/useWidgetSync';
import { useTimeZoneBanner } from '@/features/jar/useTimeZoneBanner';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { FirstMomentTip } from '@/features/onboarding/FirstMomentTip';
import { useUnreadNotifications } from '@/features/notifications/useNotifications';
import { useFirstMomentTip } from '@/features/onboarding/useFirstMomentTip';
import { usePendingUploads } from '@/features/pending/usePendingUploads';
import { JarVisibilitySheet } from '@/features/publish/JarVisibilitySheet';
import { usePublishCelebration } from '@/features/publish/publishCelebration';
import { PublishError, publishJar, type Visibility } from '@/features/publish/publishJar';
import { useIsOffline } from '@/lib/connectivity';
import { addDays, currentSlot, localHourIn } from '@/lib/jars';
import { getSupabase } from '@/lib/supabase';
import { useScreenFocused } from '@/lib/useScreenFocused';

const MINUTE = 60_000;

// Today tab (M2-05, M2-06, M2-22, M2-23, M3-01, M3-02; FR-CAP-10, FR-JAR-01, FR-JAR-02, FR-JAR-03, FR-JAR-04, FR-PUB-01,
// FR-PUB-03, FR-PUB-04, NFR-OFF-01, NFR-OFF-03).
export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // Re-render each minute so the Now tile and greeting follow the clock.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), MINUTE);
    return () => clearInterval(id);
  }, []);

  const { userId, localDate, todayDate, jar: jarData, me, queue, queueLoaded } = useToday(now);
  const pending = usePendingUploads();
  // The bell lives on Today only (Joff, QA): its dot follows unread notifications.
  const unread = useUnreadNotifications();
  // Missing only in caches persisted before usernames (M3-06).
  const username = me?.username;
  const tz = phoneTimeZone();
  // Offline the persisted cache answers; a cached jar whose day has ended shows as the new, empty day.
  const jar = openTodayJar(jarData, now);
  // The pack tile follows the jar's own clock (it changes every few hours); `now` ticks each minute.
  const featuredPack = useFeaturedPack(jar?.jar?.localDate ?? localDate, localHourIn(now, jar?.jar?.tz ?? tz));
  const offline = useIsOffline();
  const zone = useTimeZoneBanner({ userId, jar: jar?.jar ?? null, previousTz: jar?.previousTz });
  const { t } = useTranslation();
  // Full jar celebration, then Sticker unlocked, once each (M2-28).
  useCelebrations({ userId, today: jar, open: (href) => router.push(href) });

  // At the jar's end (or the phone's midnight) switch to the new day at once, not at the next minute tick,
  // and refetch even when the date key stays the same (a travel jar ending on its own clock).
  useRollover(jar?.jar ?? null, tz, () => {
    setNow(new Date());
    if (userId !== null) void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
  });

  // Coming back to the tab (e.g. after a capture) re-reads the queue and the jar; the first focus is
  // the initial load, which the queries already do.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (userId === null) return;
      unread.refresh();
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- unread.refresh is a new function each render
    }, [queryClient, userId]),
  );

  const tiles = buildTodayGrid({
    localDate: jar?.jar?.localDate ?? localDate,
    moments: jar?.moments ?? [],
    queue,
    nowSlot: currentSlot(now, tz),
    jarTz: jar?.jar?.tz ?? null,
  });
  // A slot filled since the last look pops in with a light haptic (D-58); the 8th keeps only the Full jar
  // celebration. Nothing pops until the jar and the queue have loaded.
  const loadedDate = jarData !== undefined && queueLoaded ? (jar?.jar?.localDate ?? localDate) : null;
  const poppingSlots = useFillPops(tiles, loadedDate, { skipFull: true });
  // Back from Publish: confetti and the lid closing, once (D-58).
  const celebratePublish = usePublishCelebration(jar?.jar?.id ?? null);
  // Slot reminders and the push token (M3-18): a filled day slot cancels today's reminder for it.
  useReminderSync(
    userId,
    DAY_SLOTS.filter((slot) => tiles.some((tile) => tile.slot === slot && holdsSlot(tile))),
  );
  // Home screen widgets (M6-09): every filled slot, offline captures included.
  useWidgetSync(
    userId,
    tiles.filter(holdsSlot).map((tile) => tile.slot),
    jar?.jar?.tz ?? tz,
  );

  // First moment tip (M4-09): once, on the first day while the jar is empty.
  const nowSlot = currentSlot(now, tz);
  // Only while Today is in front: its sheet is a modal, which would stay over a screen opened from a link.
  const focused = useScreenFocused();
  const tip = useFirstMomentTip(userId, focused && jar?.hasAnyJar === false && !tiles.some(holdsSlot));
  // Take my first moment opens Camera, and See how Pickld works the guide, once the sheet's modal has closed.
  const afterTip = useRef<'camera' | 'guide' | null>(null);

  // The jar's visibility menu (M3-02). Once published, RLS shares every new live, non-private moment with
  // whoever the visibility allows (FR-PUB-04), so changing it is the only step. The jars trigger keeps
  // the first published_at, so re-publishing with a new visibility is that change.
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const changeVisibility = useMutation({
    networkMode: 'always',
    mutationFn: (input: { jarId: string; visibility: Visibility }) =>
      publishJar(getSupabase(), input.jarId, input.visibility),
    onSuccess: () => {
      if (userId !== null) void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
      setVisibilityOpen(false);
    },
  });
  const openJar = jar?.jar ?? null;
  const saveLine = useSaveJarLine(userId);
  // The line row is there as soon as the day holds a moment, not only once the first upload has made the jar,
  // so nothing above the grid (the guide's tip) moves when it lands (Joff). Until then a photo waiting in the
  // queue says which jar it will go into, and a line saved meanwhile makes that jar first.
  const shownDate = jar?.jar?.localDate ?? localDate;
  const queued = openJar ? undefined : queue.find((item) => item.localDate === shownDate && item.draft !== true);
  const lineTarget = queued?.tz ? { localDate: queued.localDate, tz: queued.tz } : null;
  const published =
    openJar?.publishedAt && openJar.visibility
      ? { visibility: openJar.visibility, publishedAt: openJar.publishedAt, likeCount: openJar.likeCount ?? 0 }
      : null;

  // First-time guide tips (FR-ONB-10), one per visit: the eight slots once the first moment is in (the First
  // moment sheet covers the empty first day), then Publish while today's jar can be published. Never over a
  // sheet or the Publish celebration.
  const holdsMoment = tiles.some(holdsSlot);
  const calm = !tip.visible && !visibilityOpen && !celebratePublish;
  const guide = useGuideTip(
    [
      { id: 'today', when: calm && (jar?.hasAnyJar === true || holdsMoment) },
      { id: 'publish', when: calm && openJar !== null && !openJar.publishedAt && holdsMoment },
    ],
    focused,
  );

  return (
    <View style={styles.root} {...guide.catchTaps}>
      <TodayView
        now={now}
        tz={tz}
        todayDate={todayDate}
        tiles={tiles}
        coverMomentId={jar?.jar?.coverMomentId ?? null}
        hasAnyJar={jar ? jar.hasAnyJar : null}
        displayName={me?.displayName ?? null}
        avatarUrl={me?.avatarUrl ?? null}
        readerCount={me?.readerCount ?? null}
        lidColor={me?.lidColor}
        insets={insets}
        offlineCount={offlineBannerCount(queue, offline)}
        onCapture={(slot) => router.push({ pathname: '/camera', params: { slot } })}
        onOpenMyDays={() => router.push('/my-days')}
        onOpenStickers={() => router.push('/stickers')}
        pendingCount={pending.count}
        onOpenPending={() => router.push('/pending')}
        onOpenNotifications={() => router.push('/notifications')}
        hasUnread={unread.hasUnread}
        onOpenProfile={username ? () => router.push({ pathname: '/u/[username]', params: { username } }) : undefined}
        onRetry={(queueId) => void retryUpload(queueId)}
        zoneTag={zone.zones ? t('timeZone.tag', { zone: zone.zones.to }) : null}
        suspension={me?.suspendedUntil !== undefined ? <SuspensionBanner until={me.suspendedUntil} tz={tz} /> : null}
        zoneBanner={
          zone.show && zone.zones ? (
            <TimeZoneBanner from={zone.zones.from} to={zone.zones.to} onDismiss={zone.acknowledge} />
          ) : null
        }
        onOpenMoment={(id) => router.push({ pathname: '/moment/[id]', params: { id } })}
        // The moment preview (QA item 3, D-54); Moment options is its More menu.
        onOpenDraft={(queueId) => router.push(`/edit/${queueId}`)}
        onOpenPreview={(tile) => router.push({ pathname: '/moment/preview', params: { slot: tile.slot } })}
        onPublish={jar?.jar && !jar.jar.publishedAt ? () => router.push('/publish') : null}
        published={published}
        onOpenVisibility={() => {
          changeVisibility.reset();
          setVisibilityOpen(true);
        }}
        poppingSlots={poppingSlots}
        celebratePublish={celebratePublish}
        featuredPack={featuredPack}
        onOpenPack={(slug) => router.push({ pathname: '/stickers/pack/[slug]', params: { slug } })}
        // Previous day (‹ or a swipe right) opens the day before this jar's date, in its own zone (Joff); there is
        // no next day. `via: 'step'` fades the day page in, so it doesn't slide in against the swipe.
        step={{
          previous: addDays(todayDate, -1),
          next: null,
          onStep: (date) => router.push({ pathname: '/day/[date]', params: { date, via: 'step' } }),
        }}
        dayLine={
          openJar || lineTarget ? (
            <DayLine
              // By date, not jar id: the jar arriving mid-edit keeps the field open.
              key={shownDate}
              line={openJar?.line ?? null}
              onSave={async (line) => {
                const jarId = openJar?.id ?? (lineTarget ? await ensureLineJar(getSupabase(), lineTarget) : null);
                if (jarId === null) throw new Error('no jar for the line');
                return saveLine.mutateAsync({ jarId, line });
              }}
            />
          ) : null
        }
        guideTip={
          guide.tip === 'today' || guide.tip === 'publish' ? (
            <GuideTip
              id={guide.tip}
              arrow={guide.tip === 'today' ? { side: 'bottom', align: 'start' } : { side: 'top', align: 'end' }}
              onClose={guide.close}
              tipRef={guide.tipRef}
            />
          ) : null
        }
      />
      {published && openJar ? (
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
          onChange={(visibility) => changeVisibility.mutate({ jarId: openJar.id, visibility })}
          onClose={() => setVisibilityOpen(false)}
        />
      ) : null}
      <FirstMomentTip
        visible={tip.visible}
        slot={nowSlot}
        lidColor={me?.lidColor}
        onClose={tip.close}
        onTake={() => {
          afterTip.current = 'camera';
          tip.close();
        }}
        onHowItWorks={() => {
          afterTip.current = 'guide';
          tip.close();
        }}
        onClosed={() => {
          const next = afterTip.current;
          afterTip.current = null;
          if (next === 'camera') router.push(nowSlot ? { pathname: '/camera', params: { slot: nowSlot } } : '/camera');
          else if (next === 'guide') router.push({ pathname: '/guide', params: { from: 'first_tip' } });
        }}
      />
      {/* An upload whose slot was taken asks whether to Replace (M2-22). */}
      <ConflictReplacePrompt queue={queue} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
