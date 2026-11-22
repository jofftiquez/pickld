import { useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyDaysView } from '@/features/days/MyDaysView';
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
  withQueued,
} from '@/features/days/monthGrid';
import { useDayJar } from '@/features/days/useDayJar';
import { GuideTip } from '@/features/guide/GuideTip';
import { useGuideTip } from '@/features/guide/useGuideTip';
import { useMonthJars } from '@/features/days/useMonthJars';
import { unpublishedQueryKeys, useUnpublishedJars } from '@/features/days/useUnpublishedJars';
import { openTodayJar } from '@/features/jar/rollover';
import { phoneTimeZone, useToday } from '@/features/jar/useToday';
import { localDateIn } from '@/lib/jars';
import { useScreenFocused } from '@/lib/useScreenFocused';

// My jars (M2-25, M2-26; FR-DAY-01, FR-DAY-02; called My days before): the month calendar, with a Not published
// row above it while past days from the last week wait (/unpublished). Tapping a past date opens that day's page
// straight away (D-153), as Go to a date does; there it is filled from the gallery. A stack screen opened
// from the calendar button on Today, not a tab (D-52).
export default function MyDaysScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = new Date();
  const today = localDateIn(now, phoneTimeZone());
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState(currentMonth);
  // The day last opened, marked on the calendar when coming back to it.
  const [openedDate, setOpenedDate] = useState<string | null>(null);
  const { userId, jars, firstJarMonth, birthday } = useMonthJars(month);
  const { queue } = useDayJar(null);
  const { jars: unpublished } = useUnpublishedJars();
  // The jar Today shows: today's, or yesterday's while it is still open after flying west (travel rule).
  const { jar: todayJar, me } = useToday(now);
  const openJarDate = openTodayJar(todayJar, now)?.jar?.localDate ?? null;
  // The month's jars plus photos still waiting to upload, so a day just filled shows at once (rule 3, D-148).
  const monthJars = withQueued(
    jars ?? [],
    queue.filter((item) => monthOf(item.localDate) === month),
  );

  // Coming back to the screen (e.g. after filling a day) re-reads the months; the first focus is the initial load.
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
      void queryClient.invalidateQueries({ queryKey: unpublishedQueryKeys.list(userId) });
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
    jars: monthJars,
  });
  // A date from the calendar or the date picker opens that day's page (D-55, D-153). Today, and the open
  // jar Today still shows (travel rule), are the Today tab; future dates open nothing. The calendar moves to
  // that month, so Back lands on it.
  const openDay = (date: string) => {
    if (date > today || !pickableMonths.includes(monthOf(date))) return;
    setMonth(monthOf(date));
    setOpenedDate(date);
    if (date === today || date === openJarDate) router.navigate('/today');
    else router.push({ pathname: '/day/[date]', params: { date } });
  };

  // First-time guide (FR-ONB-10): what Not published is, once, the first time the row shows.
  const guide = useGuideTip([{ id: 'unpublished', when: (unpublished?.length ?? 0) > 0 }], useScreenFocused());

  return (
    <View style={styles.root} {...guide.catchTaps}>
      <MyDaysView
        grid={grid}
        momentCount={monthMomentCount(monthJars)}
        nav={nav}
        selectedDate={openedDate}
        insets={insets}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        onPrevious={() => nav.canGoPrevious && setMonth(addMonths(month, -1))}
        onNext={() => nav.canGoNext && setMonth(addMonths(month, 1))}
        pickableMonths={pickableMonths}
        onPickMonth={(picked) => pickableMonths.includes(picked) && setMonth(picked)}
        onPickDate={openDay}
        today={today}
        lidColor={me?.lidColor}
        onSelectDay={openDay}
        onMemories={() => router.push('/memories')}
        unpublishedCount={unpublished?.length ?? 0}
        onUnpublished={() => router.push('/unpublished')}
        guideTip={
          guide.tip === 'unpublished' ? (
            <GuideTip
              id="unpublished"
              arrow={{ side: 'top', align: 'start' }}
              onClose={guide.close}
              tipRef={guide.tipRef}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
