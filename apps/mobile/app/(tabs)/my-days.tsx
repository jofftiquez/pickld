import { useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyDaysView } from '@/features/days/MyDaysView';
import { SelectedDayCard } from '@/features/days/SelectedDayCard';
import {
  addMonths,
  buildMonthGrid,
  monthMomentCount,
  monthNav,
  monthOf,
  weekStartFrom,
} from '@/features/days/monthGrid';
import { useDayJar } from '@/features/days/useDayJar';
import { useMonthJars } from '@/features/days/useMonthJars';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { phoneTimeZone } from '@/features/jar/useToday';
import { localDateIn } from '@/lib/jars';

// My days tab (M2-25, M2-26; FR-DAY-01, FR-DAY-02): the month calendar and the selected day with Fill this jar.
export default function MyDaysScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = localDateIn(new Date(), phoneTimeZone());
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { userId, jars, firstJarMonth } = useMonthJars(month);
  const { day, queue } = useDayJar(selectedDate);

  // Coming back to the tab (e.g. after a capture) re-reads the months; the first focus is the initial load.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (userId === null) return;
      void queryClient.invalidateQueries({ queryKey: ['month', userId] });
      void queryClient.invalidateQueries({ queryKey: ['day', userId] });
    }, [queryClient, userId]),
  );

  const nav = monthNav(month, currentMonth, firstJarMonth ?? null);
  const grid = buildMonthGrid({
    month,
    today,
    weekStart: weekStartFrom(getCalendars()[0]?.firstWeekday),
    jars: jars ?? [],
  });

  // The selected day's slots: its server moments merged with photos still in the queue.
  const tiles = selectedDate
    ? buildTodayGrid({ localDate: selectedDate, moments: day?.moments ?? [], queue, nowSlot: null })
    : [];
  const onFill = () => {
    const slot = tiles.find((tile) => !holdsSlot(tile))?.slot;
    if (selectedDate === null || slot === undefined) return;
    router.push({ pathname: '/camera', params: { date: selectedDate, slot } });
  };

  const jarId = day?.jar?.id ?? null;

  return (
    <MyDaysView
      grid={grid}
      momentCount={monthMomentCount(jars ?? [])}
      nav={nav}
      selectedDate={selectedDate}
      insets={insets}
      onPrevious={() => nav.canGoPrevious && setMonth(addMonths(month, -1))}
      onNext={() => nav.canGoNext && setMonth(addMonths(month, 1))}
      onSelectDay={setSelectedDate}
      selectedDay={
        selectedDate ? (
          <SelectedDayCard
            date={selectedDate}
            tiles={tiles}
            isPast={selectedDate < today}
            onFill={onFill}
            onViewJar={jarId ? () => router.push({ pathname: '/jar/[id]', params: { id: jarId } }) : undefined}
          />
        ) : null
      }
    />
  );
}
