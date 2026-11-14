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
  earliestMonth,
  floorMonth,
  monthMomentCount,
  monthNav,
  monthOf,
  monthsBetween,
  weekStartFrom,
} from '@/features/days/monthGrid';
import { useDayJar } from '@/features/days/useDayJar';
import { useMonthJars } from '@/features/days/useMonthJars';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { phoneTimeZone } from '@/features/jar/useToday';
import { localDateIn } from '@/lib/jars';

// My days (M2-25, M2-26; FR-DAY-01, FR-DAY-02): the month calendar and the selected day with Fill this jar,
// which opens that day's page (D-55). A stack screen opened from the calendar button on Today, not a tab (D-52).
export default function MyDaysScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = localDateIn(new Date(), phoneTimeZone());
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { userId, jars, firstJarMonth, birthday } = useMonthJars(month);
  const { day, queue } = useDayJar(selectedDate);

  // Coming back to the screen (e.g. after a capture) re-reads the months; the first focus is the initial load.
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
      // A day filled before the first jar moves the Previous bound back.
      void queryClient.invalidateQueries({ queryKey: ['firstJarMonth', userId] });
    }, [queryClient, userId]),
  );

  // How far back it goes (D-141): the birth year's January (or January 2000 until known), or the first jar.
  const earliest = earliestMonth(floorMonth(birthday), firstJarMonth ?? null);
  const nav = monthNav(month, currentMonth, earliest);
  // The month and date pickers offer the same months Previous and Next reach.
  const pickableMonths = monthsBetween(earliest, currentMonth);
  const grid = buildMonthGrid({
    month,
    today,
    weekStart: weekStartFrom(getCalendars()[0]?.firstWeekday),
    jars: jars ?? [],
  });
  // A date from the date picker opens that day's page (D-55), as Fill this jar does; today is the Today tab.
  // The calendar moves to that day too, so Back lands on it.
  const onPickDate = (date: string) => {
    if (date > today || !pickableMonths.includes(monthOf(date))) return;
    setMonth(monthOf(date));
    setSelectedDate(date);
    if (date === today) router.navigate('/today');
    else router.push({ pathname: '/day/[date]', params: { date } });
  };

  // The selected day's slots: its server moments merged with photos still in the queue.
  const tiles = selectedDate
    ? buildTodayGrid({ localDate: selectedDate, moments: day?.moments ?? [], queue, nowSlot: null })
    : [];
  const onFill = () => {
    if (selectedDate === null || !tiles.some((tile) => !holdsSlot(tile))) return;
    router.push({ pathname: '/day/[date]', params: { date: selectedDate } });
  };

  const jarId = day?.jar?.id ?? null;

  return (
    <MyDaysView
      grid={grid}
      momentCount={monthMomentCount(jars ?? [])}
      nav={nav}
      selectedDate={selectedDate}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onPrevious={() => nav.canGoPrevious && setMonth(addMonths(month, -1))}
      onNext={() => nav.canGoNext && setMonth(addMonths(month, 1))}
      pickableMonths={pickableMonths}
      onPickMonth={(picked) => pickableMonths.includes(picked) && setMonth(picked)}
      onPickDate={onPickDate}
      today={today}
      onSelectDay={setSelectedDate}
      onMemories={() => router.push('/memories')}
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
