import type { Metadata } from 'next';
import Link from 'next/link';

import { t } from '~/i18n/t';

import { pendingEmail, verifyCode } from '../actions';

export const metadata: Metadata = { title: t('marketing.code.metaTitle'), robots: { index: false } };

/** Join the waitlist, step 2 (INV-12): the 6-digit code Supabase Auth emailed. */
export default async function WaitlistCode({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const email = await pendingEmail();
  const wrong = (await searchParams).error === 'badcode';
  if (!email) {
    return (
      <div className="mk-wrap">
        <section className="mk-status" role="status">
          <h1 style={{ fontSize: 'clamp(34px,8vw,52px)' }}>{t('marketing.waitlist.expiredTitle')}</h1>
          <p className="mk-lead">{t('marketing.waitlist.expiredBody')}</p>
          <p>
            <Link className="mk-link" href="/waitlist">
              {t('marketing.code.again')}
            </Link>
          </p>
        </section>
      </div>
    );
  }
  return (
    <div className="mk-wrap">
      <section className="mk-status">
        <h1 style={{ fontSize: 'clamp(34px,8vw,52px)' }}>{t('marketing.code.title')}</h1>
        <p className="mk-lead">{t('marketing.code.body', { email })}</p>
        <form className="mk-form" action={verifyCode}>
          <label htmlFor="waitlist-code">{t('marketing.code.label')}</label>
          <div className="mk-form-row">
            <input
              id="waitlist-code"
              className="mk-input mk-code"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              aria-invalid={wrong || undefined}
              aria-describedby={wrong ? 'waitlist-code-error' : undefined}
            />
            <button className="mk-btn" type="submit">
              {t('marketing.code.submit')}
            </button>
          </div>
          {wrong ? (
            <p id="waitlist-code-error" className="mk-form-error" role="alert">
              {t('marketing.code.wrong')}
            </p>
          ) : null}
          <p className="mk-form-note">{t('marketing.code.note')}</p>
        </form>
        <p>
          <Link className="mk-link" href="/waitlist">
            {t('marketing.code.different')}
          </Link>
        </p>
      </section>
    </div>
  );
}
