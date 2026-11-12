import { aboutProblems, completeBirthday, daysInMonth, emptyAbout, isoDate, isUnder13 } from '../aboutModel';

const d = (s: string) => {
  const [year, month, day] = s.split('-').map(Number) as [number, number, number];
  return { year, month, day };
};

describe('isUnder13', () => {
  it.each([
    ['2013-11-12', '2026-11-12', false], // 13 today
    ['2013-11-13', '2026-11-12', true], // 13 tomorrow
    ['2013-12-01', '2026-11-12', true],
    ['1990-03-14', '2026-11-12', false],
    // Born on 29 Feb: in a non-leap year Postgres' "today - 13 years" lands on 28 Feb, so 13 on 1 March.
    ['2012-02-29', '2025-02-28', true],
    ['2012-02-29', '2025-03-01', false],
    ['2012-02-28', '2025-02-28', false],
    // Today is 29 Feb: the cutoff is 13 years back, clamped to 28 Feb in a non-leap year.
    ['2015-02-28', '2028-02-29', false],
    ['2015-03-01', '2028-02-29', true],
  ])('born %s, today %s → under 13: %p', (born, today, expected) => {
    expect(isUnder13(d(born), d(today))).toBe(expected);
  });
});

describe('birthday fields', () => {
  it('knows month lengths, keeping 29 Feb until a year is picked', () => {
    expect([daysInMonth(2023, 2), daysInMonth(2024, 2), daysInMonth(null, 2), daysInMonth(2024, 4)]).toEqual([
      28, 29, 29, 30,
    ]);
  });
  it('is complete only as a real date', () => {
    expect(completeBirthday({ year: 2023, month: 2, day: 29 })).toBeNull();
    expect(completeBirthday({ year: 2024, month: 2, day: null })).toBeNull();
    expect(isoDate(completeBirthday({ year: 1990, month: 3, day: 4 })!)).toBe('1990-03-04');
  });
});

describe('aboutProblems', () => {
  const ok = { displayName: 'Dale', username: 'dale', birthday: { year: 1990, month: 3, day: 14 } };
  it('passes a complete form with an available username', () => {
    expect(aboutProblems(ok, 'available')).toEqual([]);
  });
  it('lists what is missing; a username still being checked is not ready', () => {
    expect(aboutProblems(emptyAbout(), 'invalid')).toEqual(['nameEmpty', 'username', 'birthday']);
    expect(aboutProblems({ ...ok, displayName: '   ' }, 'checking')).toEqual(['nameEmpty', 'username']);
    expect(aboutProblems({ ...ok, displayName: 'x'.repeat(41) }, 'available')).toEqual(['nameTooLong']);
  });
});
