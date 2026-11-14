import { joinWaitlist } from '~/app/(marketing)/waitlist/actions';
import { t } from '~/i18n/t';

/**
 * Join the waitlist: a plain form posting to a server action, so it works before (or without) any
 * JavaScript. `source` says which form it was, for counting only; `id` keeps label/input pairs unique when a
 * page has two forms.
 */
export function WaitlistForm({ id, source }: { id: string; source: string }) {
  return (
    <form className="mk-form" action={joinWaitlist}>
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
      <p className="mk-form-note">{t('marketing.form.note')}</p>
    </form>
  );
}
