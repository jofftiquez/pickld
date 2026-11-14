'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { letIn } from '~/app/(console)/invites/actions';
import { t } from '~/i18n/t';
import type { LetInResult } from '~/lib/invites';
import { primaryButton } from '~/lib/styles';

/**
 * Let the oldest N waiting accounts in (design: ModInviteCodes). Shown to every moderator; Postgres lets only
 * founders do it (admit_waiting, 0131), and anyone else sees the founders-only message.
 */
export function LetInForm({ count }: { count: number }) {
  const [state, action, pending] = useActionState<LetInResult | null, FormData>(letIn, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <input type="hidden" name="count" value={count} />
      <button
        type="submit"
        disabled={pending || count < 1}
        style={{ ...primaryButton, fontSize: 14, minHeight: 44, opacity: pending || count < 1 ? 0.6 : 1 }}
      >
        {t('invites.letIn.button', { count })}
      </button>
      <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>{t('invites.letIn.founders')}</p>
      {state?.result === 'done' ? (
        <p role="status" style={{ margin: 0, color: colors.brandText, fontSize: 13, fontWeight: 600 }}>
          {t('invites.letIn.done', { count: state.count })}
        </p>
      ) : state ? (
        <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: 13 }}>
          {t(`invites.letIn.errors.${state.result}`)}
        </p>
      ) : null}
    </form>
  );
}
