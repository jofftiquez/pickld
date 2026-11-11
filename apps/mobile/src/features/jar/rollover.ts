// Midnight rollover (FR-JAR-04): Today switches to a new, empty jar when the open jar's day ends, without
// a restart. The timer is re-armed whenever the jar or the phone zone changes, and checked again when the
// app returns to the foreground because timers don't run while it is suspended.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isJarOpen, jarEndsAt, localDateIn } from '@/lib/jars';

import type { TodayJar } from './useToday';

/** The open jar as Today holds it. `endsAt` is the server's `ends_at` (set when a jar is re-zoned, D-1). */
export type RolloverJar = { localDate: string; tz: string; endsAt?: string | null };

// setTimeout overflows above this (about 24.8 days); a longer wait just re-arms.
const MAX_TIMEOUT = 2 ** 31 - 1;

function endOf(jar: RolloverJar): number {
  return jarEndsAt({ local_date: jar.localDate, tz: jar.tz, ends_at: jar.endsAt ?? null }).getTime();
}

/**
 * Milliseconds until Today must switch: the open jar's end (server `ends_at`, else the next midnight in
 * the jar's own zone) or the phone's next local midnight, which changes the header date and the
 * `['jar', userId, localDate]` key, whichever comes first. A jar that has already ended is ignored.
 */
export function msUntilRollover(jar: RolloverJar | null, phoneTz: string, now: Date): number {
  const t = now.getTime();
  const phoneMidnight = jarEndsAt({ local_date: localDateIn(now, phoneTz), tz: phoneTz }).getTime();
  const jarEnd = jar ? endOf(jar) : Infinity;
  return (jarEnd > t ? Math.min(jarEnd, phoneMidnight) : phoneMidnight) - t;
}

/**
 * The jar data to show at `now`: a cached jar whose day has ended (e.g. the app was offline at midnight
 * and the query key didn't change) shows as an empty new day instead.
 */
export function openTodayJar(data: TodayJar | undefined, now: Date): TodayJar | undefined {
  const jar = data?.jar;
  if (!data || !jar) return data;
  return isJarOpen({ local_date: jar.localDate, tz: jar.tz, ends_at: jar.endsAt ?? null }, now)
    ? data
    : { hasAnyJar: true, jar: null, moments: [] };
}

/** Calls `onRollover` exactly when `msUntilRollover` runs out, and on return to the foreground if it passed meanwhile. */
export function useRollover(jar: RolloverJar | null, phoneTz: string, onRollover: () => void): void {
  const callback = useRef(onRollover);
  useEffect(() => {
    callback.current = onRollover;
  });
  const localDate = jar?.localDate;
  const tz = jar?.tz;
  const endsAt = jar?.endsAt ?? null;

  useEffect(() => {
    const target = localDate !== undefined && tz !== undefined ? { localDate, tz, endsAt } : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deadline = 0;

    const arm = () => {
      clearTimeout(timer);
      const now = Date.now();
      const ms = msUntilRollover(target, phoneTz, new Date(now));
      deadline = now + ms;
      timer = setTimeout(fire, Math.min(ms, MAX_TIMEOUT));
    };
    // A capped or early timer, or a foreground before the deadline, only re-arms.
    function fire() {
      if (Date.now() >= deadline) callback.current();
      arm();
    }

    arm();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') fire();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [localDate, tz, endsAt, phoneTz]);
}
