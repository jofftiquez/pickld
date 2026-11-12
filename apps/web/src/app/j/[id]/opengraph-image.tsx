import { notFound } from 'next/navigation';

import { t } from '~/i18n/t';
import { OG_SIZE, OG_TYPE, ogImage } from '~/lib/og';
import { getJar } from '~/lib/publicPage';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = t('site.name');

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const jar = await getJar((await params).id);
  if (!jar) notFound();
  return jar.readers_only
    ? ogImage({ kind: 'readers', author: jar.author, localDate: jar.local_date })
    : ogImage({ kind: 'jar', author: jar.author, localDate: jar.local_date, count: jar.visible_count, moments: jar.moments ?? [] });
}
