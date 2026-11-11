import { getLocales } from 'expo-localization';

// Dates and times follow the phone's locale (NFR-I18N-01).
export function deviceLocale(): string {
  return getLocales()[0]?.languageTag ?? 'en-US';
}

export function formatTime(date: Date, timeZone?: string, locale = deviceLocale()): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(date);
}

export function formatShortDate(date: Date, timeZone?: string, locale = deviceLocale()): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(date);
}

/** Weekday name of a calendar date (YYYY-MM-DD), e.g. "Monday": the date's own day, whatever the phone zone. */
export function formatWeekday(localDate: string, locale = deviceLocale()): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}
