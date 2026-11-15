'use client';

import { useActionState } from 'react';

import { makeCode } from '~/app/(console)/invites/actions';
import { t } from '~/i18n/t';
import type { MakeCodeResult } from '~/lib/invites';

import { Field, FormNote } from './Field';
import { Button } from './ui/button';
import { Input } from './ui/input';

/** New code (design: ModInviteCodes). The note is required and only moderators see it. */
export function MakeCodeForm() {
  const [state, action, pending] = useActionState<MakeCodeResult | null, FormData>(makeCode, null);
  return (
    <form action={action} className="grid gap-2.5">
      <div className="grid grid-cols-[minmax(0,2fr)_110px_minmax(160px,1fr)_auto] gap-2.5">
        <Field label={t('invites.new.note')}>
          <Input name="note" required maxLength={200} />
        </Field>
        <Field label={t('invites.new.uses')}>
          <Input name="uses" type="number" required min={1} max={10000} defaultValue={1} />
        </Field>
        <Field label={t('invites.new.ends')}>
          <Input name="ends" type="date" />
        </Field>
        <Button type="submit" disabled={pending} className="self-end">
          {t('invites.new.button')}
        </Button>
      </div>
      <p className="m-0 text-[13px] text-muted-foreground">{t('invites.new.hint')}</p>
      {state?.result === 'made' ? (
        <FormNote tone="ok">{t('invites.new.made', { code: state.code })}</FormNote>
      ) : state ? (
        <FormNote tone="error">{t(`invites.new.errors.${state.result}`)}</FormNote>
      ) : null}
    </form>
  );
}
