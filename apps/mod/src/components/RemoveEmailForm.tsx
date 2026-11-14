'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { removeFromWaitlist } from '~/app/(console)/waitlist/actions';
import { t } from '~/i18n/t';
import { input, secondaryButton } from '~/lib/styles';
import type { RemoveResult } from '~/lib/waitlist';

/** Remove one email on that person's request (FR-MOD-08). The note goes to the audit log; the email doesn't. */
export function RemoveEmailForm() {
  const [result, action, pending] = useActionState<RemoveResult | null, FormData>(removeFromWaitlist, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
        {t('waitlist.remove.email')}
        <input type="email" name="email" required maxLength={254} autoComplete="off" style={input} />
      </label>
      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
        {t('waitlist.remove.note')}
        <textarea
          name="note"
          required
          maxLength={500}
          rows={2}
          placeholder={t('waitlist.remove.notePlaceholder')}
          style={{ ...input, fontSize: 14, resize: 'vertical' }}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{ ...secondaryButton, minHeight: 44, justifySelf: 'start', opacity: pending ? 0.6 : 1 }}
      >
        {t('waitlist.remove.button')}
      </button>
      {result ? (
        <p
          role={result === 'removed' ? 'status' : 'alert'}
          style={{ margin: 0, color: result === 'removed' ? colors.muted : colors.danger, fontSize: 13 }}
        >
          {t(`waitlist.remove.results.${result}`)}
        </p>
      ) : null}
    </form>
  );
}
