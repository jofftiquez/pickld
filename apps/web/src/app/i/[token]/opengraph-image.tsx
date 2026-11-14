import { notFound } from 'next/navigation';

import { t } from '~/i18n/t';
import { getInvite } from '~/lib/invitePage';
import { OG_SIZE, OG_TYPE, ogImage } from '~/lib/og';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = t('site.name');

/** The inviter's photo and name with the jar (INV-05); only personal invites name someone, and none show photos. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const page = await getInvite((await params).token);
  if (page.state !== 'ok' || !page.inviter) notFound();
  return ogImage({ kind: 'invite', author: page.inviter });
}
