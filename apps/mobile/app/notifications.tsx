import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { phoneTimeZone, useToday } from '@/features/jar/useToday';
import { NotificationsView } from '@/features/notifications/NotificationsView';
import { useNotifications } from '@/features/notifications/useNotifications';
import { useFollow } from '@/features/profile/useFollow';
import { DAY_SLOTS } from '@/features/reminders/reminderPlan';
import { currentSlot } from '@/lib/jars';

// /notifications (M3-19; FR-NOT-03): from the bell on the Jars tab. Opening it marks everything read.
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [now] = useState(() => new Date());
  const tz = phoneTimeZone();
  const { userId, data, failed, refresh, markAllRead } = useNotifications();
  const follow = useFollow(userId);
  const today = useToday(now);
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (userId !== null) markAllRead();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- markAllRead is a new function each render
    }, [userId]),
  );

  // The pinned reminder: the current day slot, while today's jar doesn't hold it yet.
  const slot = currentSlot(now, tz);
  const tiles = buildTodayGrid({
    localDate: today.jar?.jar?.localDate ?? today.localDate,
    moments: today.jar?.moments ?? [],
    queue: today.queue,
    nowSlot: slot,
    jarTz: today.jar?.jar?.tz ?? null,
  });
  const daySlot = DAY_SLOTS.find((s) => s === slot) ?? null;
  const reminderSlot =
    daySlot !== null && today.jar !== undefined && !tiles.some((tile) => tile.slot === daySlot && holdsSlot(tile))
      ? daySlot
      : null;

  return (
    <NotificationsView
      data={data}
      failed={failed}
      isRefreshing={pulling}
      reminderSlot={reminderSlot}
      now={now}
      tz={tz}
      insets={insets}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/jars');
      }}
      onRefresh={() => {
        setPulling(true);
        void refresh().finally(() => setPulling(false));
      }}
      onCapture={(s) => router.push({ pathname: '/capture', params: { slot: s } })}
      onOpen={(target) => router.push(target)}
      onFollow={(entry) => {
        const actor = entry.actors[0];
        if (actor) {
          follow.setReading({ authorId: actor.id, username: actor.username, reading: true });
          void refresh();
        }
      }}
    />
  );
}
