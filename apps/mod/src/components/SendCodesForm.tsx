'use client';

import { useActionState } from 'react';

import { sendCodes } from '~/app/(console)/waitlist/actions';
import { t } from '~/i18n/t';
import type { SendResult } from '~/lib/waitlist';

import { Field, FormNote } from './Field';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Email a code to the oldest N people on the waitlist (INV-09). Shown to every moderator; only founders can
 * send, and anyone else sees the founders-only message.
 */
export function SendCodesForm({ ready }: { ready: number }) {
  const [state, action, pending] = useActionState<SendResult | null, FormData>(sendCodes, null);
  return (
    <form action={action} className="grid justify-items-start gap-2.5">
      <Field label={t('waitlist.codes.count')}>
        <Input
          type="number"
          name="count"
          required
          min={1}
          max={500}
          defaultValue={Math.min(Math.max(ready, 1), 500)}
          className="w-36"
        />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="resendExpired" className="size-5 accent-primary" />
        {t('waitlist.codes.resendExpired')}
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? t('waitlist.codes.sending') : t('waitlist.codes.button')}
      </Button>
      <p className="m-0 text-xs text-muted-foreground">{t('waitlist.codes.founders')}</p>
      {state?.result === 'sent' ? (
        <FormNote tone="ok">
          {state.total === 0
            ? t('waitlist.codes.results.none')
            : t('waitlist.codes.results.sent', { count: state.sent })}
        </FormNote>
      ) : state ? (
        <FormNote tone="error">
          {state.result === 'send_failed'
            ? t('waitlist.codes.results.send_failed', { sent: state.sent, total: state.total })
            : t(`waitlist.codes.results.${state.result}`)}
        </FormNote>
      ) : null}
    </form>
  );
}
