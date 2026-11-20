'use client';

import { useActionState, useState } from 'react';

import { letIn } from '~/app/(console)/invites/actions';
import { t } from '~/i18n/t';
import type { LetInResult } from '~/lib/invites';

import { Field, FormNote } from './Field';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Let the oldest N waiting accounts in (design: ModInviteCodes). The founder picks N, from 1 to everyone
 * waiting (at most 1,000 at a time), starting at `suggested`. Shown to every moderator; Postgres lets only founders do it (admit_waiting,
 * 0131), and anyone else sees the founders-only message.
 */
export function LetInForm({ waiting, suggested }: { waiting: number; suggested: number }) {
  const [state, action, pending] = useActionState<LetInResult | null, FormData>(letIn, null);
  const [count, setCount] = useState(suggested);
  // admit_waiting's action takes 1 to 1,000 at a time.
  const most = Math.min(waiting, 1000);
  const valid = Number.isInteger(count) && count >= 1 && count <= most;
  return (
    <form action={action} className="grid justify-items-start gap-2">
      <Field label={t('invites.letIn.howMany')}>
        <Input
          type="number"
          name="count"
          required
          min={1}
          max={Math.max(most, 1)}
          value={Number.isNaN(count) ? '' : count}
          onChange={(e) => setCount(e.currentTarget.valueAsNumber)}
          disabled={waiting < 1}
          className="w-36"
        />
      </Field>
      <Button type="submit" disabled={pending || !valid}>
        {t('invites.letIn.button', { count: Number.isInteger(count) && count > 0 ? count : suggested })}
      </Button>
      <p className="m-0 text-xs text-muted-foreground">{t('invites.letIn.founders')}</p>
      {state?.result === 'done' ? (
        <FormNote tone="ok">{t('invites.letIn.done', { count: state.count })}</FormNote>
      ) : state ? (
        <FormNote tone="error">{t(`invites.letIn.errors.${state.result}`)}</FormNote>
      ) : null}
    </form>
  );
}
