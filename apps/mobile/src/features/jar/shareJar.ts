// The jar's title ("Dale’s Sunday"), used by the Jar page, Moment detail and the Share jar card.
import type { TFunction } from 'i18next';

import { deviceLocale, formatWeekday } from '@/lib/format';

import type { JarPageData } from './jarPage';

/** "Dale" from "Dale Santos". */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

export function jarTitle(data: Pick<JarPageData, 'jar' | 'author'>, t: TFunction, locale = deviceLocale()): string {
  return t('jarPage.title', {
    name: firstName(data.author.display_name),
    weekday: formatWeekday(data.jar.local_date, locale),
  });
}
