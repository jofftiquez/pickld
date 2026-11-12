import { notFound } from 'next/navigation';

import { t } from '~/i18n/t';
import { OG_SIZE, OG_TYPE, ogImage } from '~/lib/og';
import { getProfile } from '~/lib/publicPage';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = t('site.name');

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const page = await getProfile(decodeURIComponent((await params).username));
  if (!page) notFound();
  return ogImage({ kind: 'profile', author: page.profile, moments: page.jars[0]?.moments ?? [] });
}
