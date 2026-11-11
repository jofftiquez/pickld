import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { localDateIn } from '@/lib/jars';

import { msUntilRollover, openTodayJar, useRollover, type RolloverJar } from '../rollover';
import type { TodayJar } from '../useToday';

const MANILA = 'Asia/Manila';
const NEW_YORK = 'America/New_York';
const LA = 'America/Los_Angeles';
const HOUR = 3_600_000;
const MINUTE = 60_000;

describe('msUntilRollover', () => {
  it('Manila: counts down to local midnight in the jar’s zone', () => {
    const jar = { localDate: '2026-11-10', tz: MANILA };
    expect(msUntilRollover(jar, MANILA, new Date('2026-11-10T23:59:00+08:00'))).toBe(MINUTE);
    expect(msUntilRollover(jar, MANILA, new Date('2026-11-10T08:15:00+08:00'))).toBe(15 * HOUR + 45 * MINUTE);
  });

  it('no jar yet: the phone’s next local midnight', () => {
    expect(msUntilRollover(null, MANILA, new Date('2026-11-10T23:59:59.500+08:00'))).toBe(500);
  });

  it('DST: a 25-hour day (New York, fall back on 2026-11-01) and a 23-hour day (spring forward on 2026-03-08)', () => {
    // Just after midnight on the long day, the jar has 24.5 h left, not 23.5 h.
    const fallBack = { localDate: '2026-11-01', tz: NEW_YORK };
    expect(msUntilRollover(fallBack, NEW_YORK, new Date('2026-11-01T00:30:00-04:00'))).toBe(24.5 * HOUR);
    expect(msUntilRollover(fallBack, NEW_YORK, new Date('2026-11-01T00:00:00-04:00'))).toBe(25 * HOUR);
    const springForward = { localDate: '2026-03-08', tz: NEW_YORK };
    expect(msUntilRollover(springForward, NEW_YORK, new Date('2026-03-08T00:00:00-05:00'))).toBe(23 * HOUR);
  });

  it('a re-zoned jar: the server’s later ends_at wins over midnight in the zone it started in', () => {
    // Started in Manila (midnight 16:00Z), flown to LA: ensure_jar moved ends_at to LA midnight.
    const jar: RolloverJar = { localDate: '2026-11-10', tz: MANILA, endsAt: '2026-11-11T08:00:00Z' };
    const now = new Date('2026-11-10T15:00:00Z');
    expect(msUntilRollover(jar, LA, now)).toBe(17 * HOUR);
  });

  it('travel east: the phone’s midnight comes first (header date and query key change), then the jar’s end', () => {
    const jar = { localDate: '2026-11-10', tz: LA }; // ends 2026-11-11T08:00Z
    expect(msUntilRollover(jar, MANILA, new Date('2026-11-10T15:00:00Z'))).toBe(HOUR); // Manila midnight 16:00Z
    expect(msUntilRollover(jar, MANILA, new Date('2026-11-10T16:00:00Z'))).toBe(16 * HOUR);
  });

  it('a jar that already ended is ignored instead of firing at once', () => {
    const ended = { localDate: '2026-11-09', tz: MANILA };
    expect(msUntilRollover(ended, MANILA, new Date('2026-11-10T08:00:00+08:00'))).toBe(16 * HOUR);
  });
});

describe('openTodayJar', () => {
  const data: TodayJar = {
    hasAnyJar: true,
    jar: { id: 'jar-1', localDate: '2026-11-10', tz: MANILA, endsAt: null },
    moments: [
      {
        id: 'm-1',
        slot: 'ootd',
        status: 'live',
        is_private: false,
        is_backfilled: false,
        captured_at: null,
        added_at: '2026-11-10T00:00:00Z',
        thumbUrl: null,
      },
    ],
  };

  it('keeps the jar while it is open', () => {
    expect(openTodayJar(data, new Date('2026-11-10T23:59:59+08:00'))).toBe(data);
  });

  it('shows an empty new day once the cached jar has ended', () => {
    expect(openTodayJar(data, new Date('2026-11-11T00:00:00+08:00'))).toEqual({
      hasAnyJar: true,
      jar: null,
      moments: [],
    });
  });

  it('honours a later server ends_at, and a cache from before M2-06 without endsAt', () => {
    const rezoned = {
      ...data,
      jar: { id: 'jar-1', localDate: '2026-11-10', tz: MANILA, endsAt: '2026-11-11T08:00:00Z' },
    };
    expect(openTodayJar(rezoned, new Date('2026-11-11T07:59:00Z'))).toBe(rezoned);
    const legacy = { ...data, jar: { id: 'jar-1', localDate: '2026-11-10', tz: MANILA } };
    expect(openTodayJar(legacy, new Date('2026-11-11T00:00:00+08:00'))?.jar).toBeNull();
  });

  it('passes undefined and jar-less data through', () => {
    expect(openTodayJar(undefined, new Date())).toBeUndefined();
    const none: TodayJar = { hasAnyJar: false, jar: null, moments: [] };
    expect(openTodayJar(none, new Date())).toBe(none);
  });
});

describe('useRollover', () => {
  let appStateListener: (state: AppStateStatus) => void = () => {};

  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      appStateListener = cb as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function mount(jar: RolloverJar | null, phoneTz: string, now: string) {
    jest.useFakeTimers({ now: new Date(now) });
    const onRollover = jest.fn();
    const hook = await renderHook(
      ({ target, tz }: { target: RolloverJar | null; tz: string }) => useRollover(target, tz, onRollover),
      { initialProps: { target: jar, tz: phoneTz } },
    );
    return { onRollover, ...hook };
  }

  it('Manila: fires exactly at 00:00, when the new date begins, and again the next midnight', async () => {
    const { onRollover } = await mount({ localDate: '2026-11-10', tz: MANILA }, MANILA, '2026-11-10T23:58:30+08:00');
    await act(() => jest.advanceTimersByTime(90 * 1000 - 1));
    expect(onRollover).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onRollover).toHaveBeenCalledTimes(1);
    expect(localDateIn(new Date(), MANILA)).toBe('2026-11-11');

    // The ended jar is still the target until Today re-renders: no burst of calls, next is midnight.
    await act(() => jest.advanceTimersByTime(24 * HOUR - 1));
    expect(onRollover).toHaveBeenCalledTimes(1);
    await act(() => jest.advanceTimersByTime(1));
    expect(onRollover).toHaveBeenCalledTimes(2);
  });

  it('DST: fires after 25 hours on New York’s fall-back day', async () => {
    const { onRollover } = await mount(
      { localDate: '2026-11-01', tz: NEW_YORK },
      NEW_YORK,
      '2026-11-01T00:00:00-04:00',
    );
    await act(() => jest.advanceTimersByTime(24 * HOUR));
    expect(onRollover).not.toHaveBeenCalled(); // a naive 24 h timer would fire here, at 23:00 local
    await act(() => jest.advanceTimersByTime(HOUR));
    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it('re-arms for a re-zoned jar whose ends_at moved later', async () => {
    const start = { localDate: '2026-11-10', tz: MANILA };
    const { onRollover, rerender } = await mount(start, MANILA, '2026-11-10T15:00:00Z');
    // Flew to LA; the refetched jar carries the later ends_at (LA midnight, 08:00Z).
    await rerender({ target: { ...start, endsAt: '2026-11-11T08:00:00Z' }, tz: LA });
    await act(() => jest.advanceTimersByTime(HOUR)); // Manila midnight passes
    expect(onRollover).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(16 * HOUR));
    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it('on return to the foreground, rolls over if midnight passed while timers were suspended', async () => {
    const { onRollover } = await mount({ localDate: '2026-11-10', tz: MANILA }, MANILA, '2026-11-10T22:00:00+08:00');
    // Suspended: the clock moves on but no timer runs.
    jest.setSystemTime(new Date('2026-11-11T07:00:00+08:00'));
    await act(() => appStateListener('background'));
    expect(onRollover).not.toHaveBeenCalled();
    await act(() => appStateListener('active'));
    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it('a foreground before midnight does not roll over', async () => {
    const { onRollover } = await mount({ localDate: '2026-11-10', tz: MANILA }, MANILA, '2026-11-10T22:00:00+08:00');
    await act(() => appStateListener('active'));
    expect(onRollover).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(2 * HOUR));
    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it('stops on unmount', async () => {
    const { onRollover, unmount } = await mount(null, MANILA, '2026-11-10T23:00:00+08:00');
    await unmount();
    await act(() => jest.advanceTimersByTime(2 * HOUR));
    expect(onRollover).not.toHaveBeenCalled();
  });
});
