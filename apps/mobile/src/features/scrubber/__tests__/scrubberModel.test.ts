import {
  anchorFor,
  buildRail,
  dayAtFraction,
  dayOf,
  fractionOfDay,
  newerCursor,
  railMarks,
  stepDay,
} from '../scrubberModel';

// 10 rows: Nov 12 holds 6, Nov 3 holds 1, Oct 30 holds 2, Jan 5 of the year before holds 1.
const rail = buildRail([
  { day: '2026-11-12', n: 6 },
  { day: '2026-11-03', n: 1 },
  { day: '2026-10-30', n: 2 },
  { day: '2025-01-05', n: 1 },
]);

describe('the rail', () => {
  it('gives each day the share of the rail its rows take, newest at the top', () => {
    expect(rail.total).toBe(10);
    expect(rail.days.map((d) => d.start)).toEqual([0, 6, 7, 9]);
  });

  it('maps a drag to the day whose rows sit there, not to the calendar', () => {
    // Half the rail is still Nov 12: it holds 6 of 10 rows, though Nov 3 to Jan 5 spans almost two years.
    expect(dayAtFraction(rail, 0.5)).toBe('2026-11-12');
    expect(dayAtFraction(rail, 0.6)).toBe('2026-11-03');
    expect(dayAtFraction(rail, 0.69)).toBe('2026-11-03');
    expect(dayAtFraction(rail, 0.7)).toBe('2026-10-30');
    expect(dayAtFraction(rail, 0.95)).toBe('2025-01-05');
  });

  it('keeps a drag past either end on the first or last day', () => {
    expect(dayAtFraction(rail, -0.2)).toBe('2026-11-12');
    expect(dayAtFraction(rail, 1)).toBe('2025-01-05');
    expect(dayAtFraction(rail, 1.4)).toBe('2025-01-05');
    expect(dayAtFraction(buildRail([]), 0.5)).toBeNull();
  });

  it('places a day without rows at the next older day that has some', () => {
    expect(fractionOfDay(rail, '2026-11-03')).toBe(0.6);
    expect(fractionOfDay(rail, '2026-11-10')).toBe(0.6);
    expect(fractionOfDay(rail, '2026-12-01')).toBe(0);
    expect(fractionOfDay(rail, '2020-01-01')).toBe(0.9);
  });

  it('steps a screen reader to the next older or newer day with rows', () => {
    expect(stepDay(rail, '2026-11-12', 1)).toBe('2026-11-03');
    expect(stepDay(rail, '2026-11-03', -1)).toBe('2026-11-12');
    expect(stepDay(rail, '2026-11-10', 1)).toBe('2026-11-03');
    expect(stepDay(rail, '2026-11-10', -1)).toBe('2026-11-12');
    expect(stepDay(rail, '2025-01-05', 1)).toBeNull();
    expect(stepDay(rail, '2026-11-12', -1)).toBeNull();
  });
});

describe('rail marks', () => {
  it('puts one mark per month at its newest day and the year on the first month of another year', () => {
    expect(railMarks(rail, 1000, 0)).toEqual([
      { month: '2026-11', showYear: false, fraction: 0 },
      { month: '2026-10', showYear: false, fraction: 0.7 },
      { month: '2025-01', showYear: true, fraction: 0.9 },
    ]);
  });

  it('leaves out a mark that would crowd the one above it', () => {
    // 100 px tall: October at 70 px, January at 90 px; 24 px apart is the minimum.
    expect(railMarks(rail, 100, 24).map((m) => m.month)).toEqual(['2026-11', '2026-10']);
  });
});

describe('jumping to a day', () => {
  it('anchors at the next local midnight, so the day itself comes first', () => {
    expect(anchorFor('2026-11-03', 'Asia/Manila')).toBe('2026-11-03T16:00:00.000Z');
    // The day a spring-forward change happens still ends at the next midnight (New York, 2026-03-08).
    expect(anchorFor('2026-03-07', 'America/New_York')).toBe('2026-03-08T05:00:00.000Z');
    expect(anchorFor('2026-03-08', 'America/New_York')).toBe('2026-03-09T04:00:00.000Z');
  });

  it("reads a row's day in the zone, not in UTC", () => {
    expect(dayOf('2026-11-03T17:30:00Z', 'Asia/Manila')).toBe('2026-11-04');
    expect(dayOf('2026-11-03T17:30:00Z', 'UTC')).toBe('2026-11-03');
  });
});

describe('scrolling up from a jumped-to day', () => {
  const anchor = { at: '2026-11-03T16:00:00.000Z', id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' };
  const top = { at: '2026-11-03T09:00:00Z', id: 'row-top' };

  it('reads above the first page’s top row, and nothing above the newest-first timeline', () => {
    expect(newerCursor(anchor, top, 20, 20)).toEqual({ ...top, newer: true });
    expect(newerCursor(null, top, 20, 20)).toBeUndefined();
  });

  it('reads above the anchor itself when the jumped-to page is empty', () => {
    expect(newerCursor(anchor, undefined, 0, 20)).toEqual({ ...anchor, newer: true });
  });

  it('keeps going after a full newer page and stops after a short one', () => {
    const newer = { ...top, newer: true as const };
    expect(newerCursor(newer, { at: '2026-11-05T01:00:00Z', id: 'higher' }, 20, 20)).toEqual({
      at: '2026-11-05T01:00:00Z',
      id: 'higher',
      newer: true,
    });
    expect(newerCursor(newer, { at: '2026-11-05T01:00:00Z', id: 'higher' }, 19, 20)).toBeUndefined();
  });
});
