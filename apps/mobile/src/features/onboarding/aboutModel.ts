// About you (M4-04; FR-ACC-03, FR-ACC-04): the form's rules. The database is the referee: profiles refuses
// a birthday under 13 and checks names and usernames (0001, 0016); these mirror it so the form can say why.
import { NAME_MAX, type UsernameStatus } from '@/features/profile/editProfileModel';

export const MIN_AGE = 13;
/** Oldest birth year offered: 100 years back. */
export const YEAR_SPAN = 100;

export type Birthday = { year: number | null; month: number | null; day: number | null };
export type YMD = { year: number; month: number; day: number };

export type AboutForm = { displayName: string; username: string; birthday: Birthday };

export const emptyAbout = (displayName = ''): AboutForm => ({
  displayName,
  username: '',
  birthday: { year: null, month: null, day: null },
});

export function daysInMonth(year: number | null, month: number | null): number {
  if (month === null) return 31;
  // Day 0 of the next month is this month's last day; a missing year counts as a leap year so 29 Feb stays.
  return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
}

/** A complete, real date, or null. */
export function completeBirthday(b: Birthday): YMD | null {
  if (b.year === null || b.month === null || b.day === null) return null;
  if (b.day > daysInMonth(b.year, b.month)) return null;
  return { year: b.year, month: b.month, day: b.day };
}

/**
 * Under 13 on `today` (the phone's local date). Same rule as Postgres' `birthday <= current_date - 13
 * years`: subtracting years from 29 Feb lands on 28 Feb, so someone born 29 Feb turns 13 on 1 March in a
 * non-leap year.
 */
export function isUnder13(birthday: YMD, today: YMD): boolean {
  const year = today.year - MIN_AGE;
  const cutoff = { year, month: today.month, day: Math.min(today.day, daysInMonth(year, today.month)) };
  return compare(birthday, cutoff) > 0;
}

const compare = (a: YMD, b: YMD) => a.year - b.year || a.month - b.month || a.day - b.day;

export const isoDate = ({ year, month, day }: YMD) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function yearOptions(today: YMD): number[] {
  return Array.from({ length: YEAR_SPAN + 1 }, (_, i) => today.year - i);
}

export type AboutProblem = 'nameEmpty' | 'nameTooLong' | 'username' | 'birthday';

export function aboutProblems(form: AboutForm, username: UsernameStatus): AboutProblem[] {
  const problems: AboutProblem[] = [];
  const name = form.displayName.trim();
  if (name.length === 0) problems.push('nameEmpty');
  if (Array.from(name).length > NAME_MAX) problems.push('nameTooLong');
  if (username !== 'available') problems.push('username');
  if (completeBirthday(form.birthday) === null) problems.push('birthday');
  return problems;
}
