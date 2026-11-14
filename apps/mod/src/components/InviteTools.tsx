'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { grantInviteSet, setInviteFreeze } from '~/app/(console)/users/actions';
import { t } from '~/i18n/t';
import type { FreezeResult, GrantResult } from '~/lib/invites';
import { input, secondaryButton } from '~/lib/styles';

const button = { ...secondaryButton, minHeight: 44, justifySelf: 'start' } as const;

/** Give another set of 8 personal codes (INV-03). */
export function GrantSetForm({ user }: { user: string }) {
  const [state, action, pending] = useActionState<GrantResult | null, FormData>(grantInviteSet, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 6 }}>
      <input type="hidden" name="user" value={user} />
      <button type="submit" disabled={pending} style={{ ...button, opacity: pending ? 0.6 : 1 }}>
        {t('users.invites.grant')}
      </button>
      {state?.result === 'granted' ? (
        <p role="status" style={{ margin: 0, color: colors.brandText, fontSize: 13, fontWeight: 600 }}>
          {t('users.invites.granted', { set: state.set_no })}
        </p>
      ) : state ? (
        <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: 13 }}>
          {t(`users.invites.errors.${state.result}`)}
        </p>
      ) : null}
    </form>
  );
}

/** Pause a person's invites, or let them work again. The note is required and goes to the audit log. */
export function InviteFreezeForm({ user, lift }: { user: string; lift: boolean }) {
  const [result, action, pending] = useActionState<FreezeResult | null, FormData>(setInviteFreeze, null);
  const done = result === 'frozen' || result === 'unfrozen';
  return (
    <form action={action} style={{ display: 'grid', gap: 8 }}>
      <input type="hidden" name="user" value={user} />
      <input type="hidden" name="lift" value={lift ? '1' : '0'} />
      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
        {t(lift ? 'users.invites.unfreezeNote' : 'users.invites.freezeNote')}
        <textarea
          name="note"
          required
          maxLength={500}
          rows={2}
          placeholder={t('users.notePlaceholder')}
          style={{ ...input, fontSize: 14, resize: 'vertical' }}
        />
      </label>
      <button type="submit" disabled={pending} style={{ ...button, opacity: pending ? 0.6 : 1 }}>
        {t(lift ? 'users.invites.unfreeze' : 'users.invites.freeze')}
      </button>
      {result && !done ? (
        <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: 13 }}>
          {t(`users.invites.errors.${result}`)}
        </p>
      ) : null}
    </form>
  );
}
