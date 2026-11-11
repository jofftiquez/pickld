import { createContext, useContext } from 'react';

import { deviceLocale, formatTime } from '@/lib/format';

import type { stickerStamps } from '../edits';

export type StampKind = (typeof stickerStamps)[number];

/** The moment an auto stamp describes: when its photo was taken, in its jar's IANA zone. */
export type StampMoment = { capturedAt: Date; tz: string };

/**
 * The live text of an auto stamp (FR-STK-01: "auto time, date, jar number"), from the moment's capture
 * time in its jar's zone, styled like the art: "2:14 PM", "NOV 11", "WEDNESDAY". Null for the jar number,
 * which the editor doesn't know yet: that stamp shows its art.
 */
export function stampText(kind: StampKind, moment: StampMoment, locale = deviceLocale()): string | null {
  const { capturedAt, tz } = moment;
  switch (kind) {
    case 'time':
      return formatTime(capturedAt, tz, locale).toUpperCase();
    case 'date':
      return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: tz })
        .format(capturedAt)
        .replace('.', '')
        .toUpperCase();
    case 'weekday':
      return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: tz }).format(capturedAt).toUpperCase();
    case 'jar_number':
      // TODO(M2-18 #47): draw "JAR #n" once the moment renderer has the jar number; until then, the art.
      return null;
  }
}

const StampMomentContext = createContext<StampMoment | null>(null);

/** Gives auto stamps the moment they describe (the editor provides it); without it they show their art. */
export const StampMomentProvider = StampMomentContext.Provider;

export function useStampMoment(): StampMoment | null {
  return useContext(StampMomentContext);
}
