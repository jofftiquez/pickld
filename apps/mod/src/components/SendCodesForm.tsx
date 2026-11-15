'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { sendCodes } from '~/app/(console)/waitlist/actions';
import { t } from '~/i18n/t';
import { input, primaryButton } from '~/lib/styles';
import type { SendResult } from '~/lib/waitlist';

/**
 * Email a code to the oldest N people on the waitlist (INV-09). Shown to every moderator; only founders can
 * send, and anyone else sees the founders-only message.
 */
export function SendCodesForm({ ready }: { ready: number }) {
  const [state, action, pending] = useActionState<SendResult | null, FormData>(sendCodes, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
        {t('waitlist.codes.count')}
        <input
          type="number"
          name="count"
          required
          min={1}
          max={500}
          defaultValue={Math.min(Math.max(ready, 1), 500)}
          style={{ ...input, width: 140 }}
        />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, minHeight: 44 }}>
        <input type="checkbox" name="resendExpired" style={{ width: 20, height: 20 }} />
        {t('waitlist.codes.resendExpired')}
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{ ...primaryButton, fontSize: 14, minHeight: 44, opacity: pending ? 0.6 : 1 }}
      >
        {pending ? t('waitlist.codes.sending') : t('waitlist.codes.button')}
      </button>
      <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>{t('waitlist.codes.founders')}</p>
      {state?.result === 'sent' ? (
        <p role="status" style={{ margin: 0, color: colors.brandText, fontSize: 13, fontWeight: 600 }}>
          {state.total === 0
            ? t('waitlist.codes.results.none')
            : t('waitlist.codes.results.sent', { count: state.sent })}
        </p>
      ) : state ? (
        <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: 13 }}>
          {state.result === 'send_failed'
            ? t('waitlist.codes.results.send_failed', { sent: state.sent, total: state.total })
            : t(`waitlist.codes.results.${state.result}`)}
        </p>
      ) : null}
    </form>
  );
}
