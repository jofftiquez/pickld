import { useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyDaysView } from '@/features/days/MyDaysView';
import {
  addMonths,
  buildMonthGrid,
  monthMomentCount,
  monthNav,
  monthOf,
  weekStartFrom,
} from '@/features/days/monthGrid';
import { useMonthJars } from '@/features/days/useMonthJars';
import { phoneTimeZone } from '@/features/jar/useToday';
import { localDateIn } from '@/lib/jars';

// My days tab (M2-25; FR-DAY-01). The selected-day card and Fill this jar come in M2-26.
export default function MyDaysScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const today = localDateIn(new Date(), phoneTimeZone());
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { userId, jars, firstJarMonth } = useMonthJars(month);

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
    }, [queryClient, userId]),
  );

  const nav = monthNav(month, currentMonth, firstJarMonth ?? null);
  const grid = buildMonthGrid({
    month,
    today,
    weekStart: weekStartFrom(getCalendars()[0]?.firstWeekday),
    jars: jars ?? [],
  });

  return (
    <MyDaysView
      grid={grid}
      momentCount={monthMomentCount(jars ?? [])}
      nav={nav}
      selectedDate={selectedDate}
      insets={insets}
      onPrevious={() => nav.canGoPrevious && setMonth(addMonths(month, -1))}
      onNext={() => nav.canGoNext && setMonth(addMonths(month, 1))}
      // TODO(M2-26): the selected-day card (moments, missing slots, Fill this jar, View jar).
      onSelectDay={setSelectedDate}
    />
  );
}
