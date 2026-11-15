'use client';

import { useActionState } from 'react';

import { removeFromWaitlist } from '~/app/(console)/waitlist/actions';
import { t } from '~/i18n/t';
import type { RemoveResult } from '~/lib/waitlist';

import { Field, FormNote } from './Field';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

/** Remove one email on that person's request (FR-MOD-08). The note goes to the audit log; the email doesn't. */
export function RemoveEmailForm() {
  const [result, action, pending] = useActionState<RemoveResult | null, FormData>(removeFromWaitlist, null);
  return (
    <form action={action} className="grid max-w-[560px] gap-2.5">
      <Field label={t('waitlist.remove.email')}>
        <Input type="email" name="email" required maxLength={254} autoComplete="off" />
      </Field>
      <Field label={t('waitlist.remove.note')}>
        <Textarea
          name="note"
          required
          maxLength={500}
          rows={2}
          placeholder={t('waitlist.remove.notePlaceholder')}
          className="resize-y"
        />
      </Field>
      <Button type="submit" disabled={pending} variant="secondary" className="justify-self-start">
        {t('waitlist.remove.button')}
      </Button>
      {result ? (
        <FormNote tone={result === 'removed' ? 'muted' : 'error'}>{t(`waitlist.remove.results.${result}`)}</FormNote>
      ) : null}
    </form>
  );
}
