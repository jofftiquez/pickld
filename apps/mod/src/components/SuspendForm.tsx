'use client';

import { useActionState } from 'react';

import { setSuspension } from '~/app/(console)/users/actions';
import { t } from '~/i18n/t';
import type { SuspendResult } from '~/lib/users';

import { Field, FormNote } from './Field';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

/** Suspend for 7 days or lift early (D-132). The note is required and goes to the audit log. */
export function SuspendForm({ user, lift }: { user: string; lift: boolean }) {
  const [result, action, pending] = useActionState<SuspendResult | null, FormData>(setSuspension, null);
  const done = result === 'suspended' || result === 'lifted';
  return (
    <form action={action} className="grid gap-2.5">
      <input type="hidden" name="user" value={user} />
      <input type="hidden" name="lift" value={lift ? '1' : '0'} />
      <Field label={t(lift ? 'users.lift.note' : 'users.suspend.note')}>
        <Textarea
          name="note"
          required
          maxLength={500}
          rows={3}
          placeholder={t('users.notePlaceholder')}
          className="resize-y"
        />
      </Field>
      <Button
        type="submit"
        disabled={pending}
        variant={lift ? 'secondary' : 'destructive'}
        className="justify-self-start"
      >
        {t(lift ? 'users.lift.button' : 'users.suspend.button')}
      </Button>
      {result && !done ? <FormNote tone="error">{t(`users.errors.${result}`)}</FormNote> : null}
    </form>
  );
}
