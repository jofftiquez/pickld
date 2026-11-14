import {
  addMonths,
  buildMonthGrid,
  daysInMonth,
  earliestMonth,
  floorMonth,
  fillFraction,
  monthJarRow,
  monthMomentCount,
  monthNav,
  monthsBetween,
  weekStartFrom,
  type DayCell,
  type GridCell,
  type MonthJar,
} from '../monthGrid';

const days = (weeks: GridCell[][]) => weeks.flat().filter((c): c is DayCell => c.kind === 'day');
const leadingBlanks = (weeks: GridCell[][]) => weeks[0]?.findIndex((c) => c.kind === 'day') ?? -1;
const trailingBlanks = (weeks: GridCell[][]) => {
  const last = weeks[weeks.length - 1] ?? [];
  return last.length - 1 - last.map((c) => c.kind).lastIndexOf('day');
};

function jar(localDate: string, count: number, cover: string | null = null): MonthJar {
  return {
    jar_id: `j-${localDate}`,
    local_date: localDate,
    tz: 'Asia/Manila',
    moment_count: count,
    is_full: count === 8,
    cover_moment_id: cover ? `m-${localDate}` : null,
    cover_thumb_path: cover ? `thumbs/${localDate}.webp` : null,
    coverUrl: cover,
  };
}

describe('buildMonthGrid', () => {
  it('February in a leap year has 29 days in full 7-day weeks', () => {
    const grid = buildMonthGrid({ month: '2028-02', today: '2028-03-15' });
    expect(daysInMonth('2028-02')).toBe(29);
    expect(days(grid.weeks).map((d) => d.day)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    // Feb 1, 2028 is a Tuesday: two leading blanks; 2 + 29 = 31 cells → 4 trailing blanks.
    expect(leadingBlanks(grid.weeks)).toBe(2);
    expect(trailingBlanks(grid.weeks)).toBe(4);
    expect(grid.weeks).toHaveLength(5);
  });

  it('February in a common year has 28 days', () => {
    expect(daysInMonth('2027-02')).toBe(28);
    expect(daysInMonth('2100-02')).toBe(28);
    expect(daysInMonth('2000-02')).toBe(29);
  });

  it('a month starting on Sunday has no leading blanks (Sunday weeks)', () => {
    const grid = buildMonthGrid({ month: '2026-11', today: '2026-11-09' });
    expect(grid.weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(leadingBlanks(grid.weeks)).toBe(0);
    expect(trailingBlanks(grid.weeks)).toBe(5); // Nov 30 is a Monday
  });

  it('February 2026 starts on Sunday with 28 days: exactly four weeks, no blanks', () => {
    const grid = buildMonthGrid({ month: '2026-02', today: '2026-03-01' });
    expect(grid.weeks).toHaveLength(4);
    expect(grid.weeks.flat().every((c) => c.kind === 'day')).toBe(true);
  });

  it('a month starting on Saturday has six leading blanks and six weeks', () => {
    const grid = buildMonthGrid({ month: '2026-08', today: '2026-11-09' });
    expect(leadingBlanks(grid.weeks)).toBe(6);
    expect(grid.weeks).toHaveLength(6); // 6 + 31 = 37 cells
    expect(trailingBlanks(grid.weeks)).toBe(5);
  });

  it('Monday-first weeks shift the columns and blanks', () => {
    const grid = buildMonthGrid({ month: '2026-11', today: '2026-11-09', weekStart: 1 });
    expect(grid.weekdays).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(leadingBlanks(grid.weeks)).toBe(6); // Sunday the 1st is the last column
    const saturdayStart = buildMonthGrid({ month: '2026-08', today: '2026-11-09', weekStart: 1 });
    expect(leadingBlanks(saturdayStart.weeks)).toBe(5);
  });

  it('marks today and disables every later day', () => {
    const grid = days(buildMonthGrid({ month: '2026-11', today: '2026-11-09' }).weeks);
    expect(grid.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-11-09']);
    expect(grid.filter((d) => d.isFuture).map((d) => d.day)).toEqual(Array.from({ length: 21 }, (_, i) => i + 10));
    expect(grid.find((d) => d.day === 9)?.isFuture).toBe(false);
  });

  it('today on the first of the month: every other day is future', () => {
    const grid = days(buildMonthGrid({ month: '2026-12', today: '2026-12-01' }).weeks);
    expect(grid[0]).toMatchObject({ day: 1, isToday: true, isFuture: false });
    expect(grid.slice(1).every((d) => d.isFuture && !d.isToday)).toBe(true);
  });

  it('today on the last of the month: no future days', () => {
    const grid = days(buildMonthGrid({ month: '2026-11', today: '2026-11-30' }).weeks);
    expect(grid.some((d) => d.isFuture)).toBe(false);
    expect(grid[29]).toMatchObject({ day: 30, isToday: true });
  });

  it('past months have no today and no future days; future months are all future', () => {
    const past = days(buildMonthGrid({ month: '2026-10', today: '2026-11-01' }).weeks);
    expect(past.some((d) => d.isToday || d.isFuture)).toBe(false);
    const future = days(buildMonthGrid({ month: '2026-12', today: '2026-11-30' }).weeks);
    expect(future.every((d) => d.isFuture)).toBe(true);
  });

  it('merges month_jars rows onto their dates, ignoring other months', () => {
    const rows = [jar('2026-11-06', 3, 'https://photos/x.webp'), jar('2026-11-08', 0), jar('2026-10-31', 8, 'u')];
    const grid = days(buildMonthGrid({ month: '2026-11', today: '2026-11-09', jars: rows }).weeks);
    expect(grid.find((d) => d.day === 6)?.jar?.coverUrl).toBe('https://photos/x.webp');
    expect(grid.find((d) => d.day === 8)?.jar).toMatchObject({ moment_count: 0, coverUrl: null });
    expect(grid.filter((d) => d.jar).map((d) => d.day)).toEqual([6, 8]);
  });
});

describe('floorMonth, earliestMonth and monthsBetween (D-141)', () => {
  it('floors at January of the birth year, or January 2000 while the birthday is unknown', () => {
    expect(floorMonth('1994-07-21')).toBe('1994-01');
    expect(floorMonth(null)).toBe('2000-01');
    expect(floorMonth(undefined)).toBe('2000-01');
    expect(floorMonth('')).toBe('2000-01');
  });

  it('reaches years back, far past the old 12-month window', () => {
    const months = monthsBetween(earliestMonth(floorMonth('2010-05-01'), null), '2026-02');
    expect(months[0]).toBe('2010-01');
    expect(months[months.length - 1]).toBe('2026-02');
    expect(months).toHaveLength(16 * 12 + 2);
    // Three years back, across year boundaries, without gaps.
    expect(months).toEqual(expect.arrayContaining(['2022-12', '2023-01', '2023-02']));
  });

  it('starts at a first jar older than the floor, so no jar is out of reach', () => {
    expect(earliestMonth('2010-01', '2008-11')).toBe('2008-11');
    expect(earliestMonth('2010-01', '2026-01')).toBe('2010-01');
  });

  it('is empty when the start is after the end', () => {
    expect(monthsBetween('2026-03', '2026-02')).toEqual([]);
  });
});

describe('monthNav', () => {
  it('stops Next at the current month', () => {
    expect(monthNav('2026-11', '2026-11', '2000-01').canGoNext).toBe(false);
    expect(monthNav('2026-10', '2026-11', '2000-01').canGoNext).toBe(true);
  });

  it('goes back to the earliest month and stops there, across a year', () => {
    // The QA bug from D-137 stays fixed: a first jar this month doesn't stop Previous at this month.
    expect(monthNav('2026-11', '2026-11', earliestMonth(floorMonth(null), '2026-11')).canGoPrevious).toBe(true);
    expect(monthNav('2010-02', '2026-11', '2010-01').canGoPrevious).toBe(true);
    expect(monthNav('2010-01', '2026-11', '2010-01')).toEqual({ canGoPrevious: false, canGoNext: true });
  });
});

describe('month helpers', () => {
  it('addMonths wraps years both ways', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-11', -23)).toBe('2024-12');
  });

  it('refuses malformed months', () => {
    expect(() => addMonths('2026-13', 1)).toThrow(RangeError);
    expect(() => daysInMonth('2026-1')).toThrow(RangeError);
  });

  it('weekStartFrom maps expo-localization weekdays (1 = Sunday) and falls back to Sunday', () => {
    expect(weekStartFrom(1)).toBe(0);
    expect(weekStartFrom(2)).toBe(1);
    expect(weekStartFrom(7)).toBe(6);
    expect(weekStartFrom(null)).toBe(0);
    expect(weekStartFrom(undefined)).toBe(0);
    expect(weekStartFrom(9)).toBe(0);
  });

  it('fill fraction is the moment count of 8, clamped', () => {
    expect(fillFraction(0)).toBe(0);
    expect(fillFraction(3)).toBe(3 / 8);
    expect(fillFraction(8)).toBe(1);
    expect(fillFraction(12)).toBe(1);
  });

  it('sums the month moments', () => {
    expect(monthMomentCount([jar('2026-11-01', 8), jar('2026-11-02', 5), jar('2026-11-04', 0)])).toBe(13);
  });
});

describe('monthJarRow', () => {
  it('accepts an empty jar with null cover columns (the generated types say non-null)', () => {
    const row = {
      jar_id: 'j1',
      local_date: '2026-11-04',
      tz: 'Asia/Manila',
      visibility: 'readers',
      published_at: null,
      moment_count: 0,
      is_full: false,
      cover_moment_id: null,
      cover_slot: null,
      cover_thumb_path: null,
    };
    expect(monthJarRow.parse(row)).toMatchObject({ cover_moment_id: null, cover_thumb_path: null });
  });
});
