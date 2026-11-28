'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';

import { sendPicked } from '~/app/(console)/waitlist/actions';
import { t } from '~/i18n/t';
import type { SendResult } from '~/lib/waitlist';

import { FormNote } from './Field';
import { Button } from './ui/button';

/**
 * Email a code to the people ticked on the waitlist (INV-09). `children` is the email list, whose rows carry
 * `email` checkboxes; only rows that can get a code now have one enabled. Only founders can send.
 */
export function SendPickedForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState<SendResult | null, FormData>(sendPicked, null);
  const form = useRef<HTMLFormElement>(null);
  const [ticked, setTicked] = useState(0);
  const recount = () => setTicked(form.current?.querySelectorAll('input[name="email"]:checked').length ?? 0);
  // The form clears its boxes after each send, and the list reloads with who was sent a code.
  useEffect(recount, [state]);

  return (
    <form ref={form} action={action} onChange={recount} aria-label={t('waitlist.picked.title')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <Button type="submit" size="sm" disabled={pending || ticked === 0}>
          {pending
            ? t('waitlist.codes.sending')
            : ticked === 0
              ? t('waitlist.picked.none')
              : t('waitlist.picked.button', { count: ticked })}
        </Button>
        <span className="text-xs text-muted-foreground">{t('waitlist.picked.hint')}</span>
        {state?.result === 'sent' ? (
          <FormNote tone="ok">
            {state.total === 0
              ? t('waitlist.picked.results.none')
              : t('waitlist.codes.results.sent', { count: state.sent })}
          </FormNote>
        ) : state ? (
          <FormNote tone="error">
            {state.result === 'send_failed'
              ? t('waitlist.codes.results.send_failed', { sent: state.sent, total: state.total })
              : state.result === 'invalid_input'
                ? t('waitlist.picked.results.invalid_input')
                : t(`waitlist.codes.results.${state.result}`)}
          </FormNote>
        ) : null}
      </div>
      {children}
    </form>
  );
}
