// The jar's title ("Dale’s Sunday") and Share jar, used by the Jar page and Moment detail.
import type { TFunction } from 'i18next';
import { Share } from 'react-native';

import { deviceLocale, formatWeekday } from '@/lib/format';
import { jarUrl } from '@/lib/links';

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

/** TODO(M4-11, #101): open the Share jar card; until then share the jar's link (C-2). */
export function shareJar(data: Pick<JarPageData, 'jar' | 'author'>, t: TFunction): void {
  void Share.share({ message: t('jarPage.shareMessage', { title: jarTitle(data, t), url: jarUrl(data.jar.id) }) });
}
