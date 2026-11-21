import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { t } from '~/i18n/t';
import { waitlistOpen } from '~/lib/env';
import { WaitlistForm } from '~/marketing/WaitlistForm';

import type { WaitlistStatus } from './actions';

export const metadata: Metadata = { title: t('marketing.waitlist.metaTitle'), robots: { index: false } };

const statuses: WaitlistStatus[] = ['joined', 'already', 'member', 'limited', 'invalid', 'captcha', 'expired', 'error'];
const final: WaitlistStatus[] = ['joined', 'already', 'member', 'limited'];

/** Join the waitlist on its own, and the answer page every waitlist form lands on. */
export default async function Waitlist({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!waitlistOpen()) notFound();
  const raw = (await searchParams).status;
  const status = statuses.find((s) => s === raw);
  const title = status ? t(`marketing.waitlist.${status}Title`) : t('marketing.waitlist.title');
  const body = status ? t(`marketing.waitlist.${status}Body`) : t('marketing.waitlist.body');
  return (
    <div className="mk-wrap">
      <section className="mk-status" role={status ? 'status' : undefined}>
        <h1 style={{ fontSize: 'clamp(34px,8vw,52px)' }}>{title}</h1>
        <p className="mk-lead">{body}</p>
        {status && final.includes(status) ? null : <WaitlistForm id="waitlist" source="waitlist" />}
        <p>
          <Link className="mk-link" href="/">
            {t('marketing.waitlist.back')}
          </Link>
        </p>
      </section>
    </div>
  );
}
