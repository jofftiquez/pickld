import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodayView } from '@/features/jar/TodayView';
import { buildTodayGrid } from '@/features/jar/todayGrid';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { currentSlot } from '@/lib/jars';

const MINUTE = 60_000;

// Today tab (M2-05; FR-JAR-01, FR-JAR-02). Midnight rollover and upload states come in M2-06.
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

  const { userId, localDate, jar, me, queue } = useToday(now);
  const tz = phoneTimeZone();

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
      onCapture={(slot) => router.push({ pathname: '/capture', params: { slot } })}
      onOpenMyDays={() => router.push('/my-days')}
    />
  );
}
