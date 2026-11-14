import type { Metadata } from 'next';
import Link from 'next/link';

import { t } from '~/i18n/t';
import { WaitlistForm } from '~/marketing/WaitlistForm';

import type { WaitlistStatus } from './actions';

export const metadata: Metadata = { title: t('marketing.waitlist.metaTitle'), robots: { index: false } };

const statuses: WaitlistStatus[] = ['joined', 'limited', 'invalid', 'error'];

/** Join the waitlist on its own, and the answer page every waitlist form lands on. */
export default async function Waitlist({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const raw = (await searchParams).status;
  const status = statuses.find((s) => s === raw);
  const title = status ? t(`marketing.waitlist.${status}Title`) : t('marketing.waitlist.title');
  const body = status ? t(`marketing.waitlist.${status}Body`) : t('marketing.waitlist.body');
  return (
    <div className="mk-wrap">
      <section className="mk-status" role={status ? 'status' : undefined}>
        <h1 style={{ fontSize: 'clamp(34px,8vw,52px)' }}>{title}</h1>
        <p className="mk-lead">{body}</p>
        {status === 'joined' || status === 'limited' ? null : <WaitlistForm id="waitlist" source="waitlist" />}
        <p>
          <Link className="mk-link" href="/">
            {t('marketing.waitlist.back')}
          </Link>
        </p>
      </section>
    </div>
  );
}
