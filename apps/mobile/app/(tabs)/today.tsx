import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimeZoneBanner } from '@/features/jar/TimeZoneBanner';
import { TodayView } from '@/features/jar/TodayView';
import { retryUpload } from '@/features/jar/retryUpload';
import { openTodayJar, useRollover } from '@/features/jar/rollover';
import { buildTodayGrid, offlineBannerCount } from '@/features/jar/todayGrid';
import { useTimeZoneBanner } from '@/features/jar/useTimeZoneBanner';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { useIsOffline } from '@/lib/connectivity';
import { currentSlot } from '@/lib/jars';

const MINUTE = 60_000;

// Today tab (M2-05, M2-06; FR-JAR-01, FR-JAR-02, FR-JAR-04, NFR-OFF-01, NFR-OFF-03).
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

  const { userId, localDate, jar: jarData, me, queue } = useToday(now);
  const tz = phoneTimeZone();
  // Offline the persisted cache answers; a cached jar whose day has ended shows as the new, empty day.
  const jar = openTodayJar(jarData, now);
  const offline = useIsOffline();
  const zone = useTimeZoneBanner({ userId, jar: jar?.jar ?? null, previousTz: jar?.previousTz });
  const { t } = useTranslation();

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
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
    }, [queryClient, userId]),
  );

  const tiles = buildTodayGrid({
    localDate: jar?.jar?.localDate ?? localDate,
    moments: jar?.moments ?? [],
    queue,
    nowSlot: currentSlot(now, tz),
  });

  return (
    <TodayView
      now={now}
      tz={tz}
      tiles={tiles}
      hasAnyJar={jar ? jar.hasAnyJar : null}
      displayName={me?.displayName ?? null}
      avatarUrl={me?.avatarUrl ?? null}
      readerCount={me?.readerCount ?? null}
      lidColor={me?.lidColor}
      insets={insets}
      offlineCount={offlineBannerCount(queue, offline)}
      onCapture={(slot) => router.push({ pathname: '/capture', params: { slot } })}
      onOpenMyDays={() => router.push('/my-days')}
      onRetry={(queueId) => void retryUpload(queueId)}
      zoneTag={zone.zones ? t('timeZone.tag', { zone: zone.zones.to }) : null}
      zoneBanner={
        zone.show && zone.zones ? (
          <TimeZoneBanner from={zone.zones.from} to={zone.zones.to} onDismiss={zone.acknowledge} />
        ) : null
      }
      onOpenMoment={(id) => router.push({ pathname: '/moment/[id]', params: { id } })}
    />
  );
}
