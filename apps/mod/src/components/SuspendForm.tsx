'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { setSuspension } from '~/app/(console)/users/actions';
import { t } from '~/i18n/t';
import { input, primaryButton, secondaryButton } from '~/lib/styles';
import type { SuspendResult } from '~/lib/users';

/** Suspend for 7 days or lift early (D-132). The note is required and goes to the audit log. */
export function SuspendForm({ user, lift }: { user: string; lift: boolean }) {
  const [result, action, pending] = useActionState<SuspendResult | null, FormData>(setSuspension, null);
  const done = result === 'suspended' || result === 'lifted';
  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      <input type="hidden" name="user" value={user} />
      <input type="hidden" name="lift" value={lift ? '1' : '0'} />
      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
        {t(lift ? 'users.lift.note' : 'users.suspend.note')}
        <textarea
          name="note"
          required
          maxLength={500}
          rows={3}
          placeholder={t('users.notePlaceholder')}
          style={{ ...input, fontSize: 14, resize: 'vertical' }}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{
          ...(lift ? secondaryButton : primaryButton),
          ...(lift ? {} : { background: colors.danger }),
          fontSize: 14,
          minHeight: 44,
          justifySelf: 'start',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {t(lift ? 'users.lift.button' : 'users.suspend.button')}
      </button>
      {result && !done ? (
        <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: 13 }}>
          {t(`users.errors.${result}`)}
        </p>
      ) : null}
    </form>
  );
}
