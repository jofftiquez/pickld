'use client';

import { useActionState } from 'react';

import { grantInviteSet, setInviteFreeze } from '~/app/(console)/users/actions';
import { t } from '~/i18n/t';
import type { FreezeResult, GrantResult } from '~/lib/invites';

import { Field, FormNote } from './Field';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

/** Give another set of 8 personal codes (INV-03). */
export function GrantSetForm({ user }: { user: string }) {
  const [state, action, pending] = useActionState<GrantResult | null, FormData>(grantInviteSet, null);
  return (
    <form action={action} className="grid gap-1.5">
      <input type="hidden" name="user" value={user} />
      <Button type="submit" disabled={pending} variant="secondary" className="justify-self-start">
        {t('users.invites.grant')}
      </Button>
      {state?.result === 'granted' ? (
        <FormNote tone="ok">{t('users.invites.granted', { set: state.set_no })}</FormNote>
      ) : state ? (
        <FormNote tone="error">{t(`users.invites.errors.${state.result}`)}</FormNote>
      ) : null}
    </form>
  );
}

/** Pause a person's invites, or let them work again. The note is required and goes to the audit log. */
export function InviteFreezeForm({ user, lift }: { user: string; lift: boolean }) {
  const [result, action, pending] = useActionState<FreezeResult | null, FormData>(setInviteFreeze, null);
  const done = result === 'frozen' || result === 'unfrozen';
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="user" value={user} />
      <input type="hidden" name="lift" value={lift ? '1' : '0'} />
      <Field label={t(lift ? 'users.invites.unfreezeNote' : 'users.invites.freezeNote')}>
        <Textarea
          name="note"
          required
          maxLength={500}
          rows={2}
          placeholder={t('users.notePlaceholder')}
          className="resize-y"
        />
      </Field>
      <Button type="submit" disabled={pending} variant="secondary" className="justify-self-start">
        {t(lift ? 'users.invites.unfreeze' : 'users.invites.freeze')}
      </Button>
      {result && !done ? <FormNote tone="error">{t(`users.invites.errors.${result}`)}</FormNote> : null}
    </form>
  );
}
