'use client';

import { useActionState } from 'react';

import { letIn } from '~/app/(console)/invites/actions';
import { t } from '~/i18n/t';
import type { LetInResult } from '~/lib/invites';

import { FormNote } from './Field';
import { Button } from './ui/button';

/**
 * Let the oldest N waiting accounts in (design: ModInviteCodes). Shown to every moderator; Postgres lets only
 * founders do it (admit_waiting, 0131), and anyone else sees the founders-only message.
 */
export function LetInForm({ count }: { count: number }) {
  const [state, action, pending] = useActionState<LetInResult | null, FormData>(letIn, null);
  return (
    <form action={action} className="grid justify-items-start gap-2">
      <input type="hidden" name="count" value={count} />
      <Button type="submit" disabled={pending || count < 1}>
        {t('invites.letIn.button', { count })}
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
