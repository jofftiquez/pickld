import { requestCode } from '~/app/(marketing)/waitlist/actions';
import { t } from '~/i18n/t';
import { turnstileSiteKey } from '~/lib/env';
import { Turnstile } from '~/marketing/Turnstile';

/**
 * Join the waitlist, step 1 (INV-12): the email and Turnstile post to a server action, which emails a 6-digit
 * code and opens the code page. `source` says which form it was, for counting only; `id` keeps label/input
 * pairs unique when a page has two forms.
 */
export function WaitlistForm({ id, source }: { id: string; source: string }) {
  return (
    <form className="mk-form" action={requestCode}>
      <label htmlFor={`${id}-email`}>{t('marketing.form.label')}</label>
      <div className="mk-form-row">
        <input
          id={`${id}-email`}
          className="mk-input"
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          placeholder={t('marketing.form.placeholder')}
        />
        <input type="hidden" name="source" value={source} />
        <button className="mk-btn" type="submit">
          {t('marketing.form.submit')}
        </button>
      </div>
      <Turnstile siteKey={turnstileSiteKey()} />
      <p className="mk-form-note">{t('marketing.form.note')}</p>
    </form>
  );
}
