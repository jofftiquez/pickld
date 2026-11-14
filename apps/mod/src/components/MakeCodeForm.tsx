'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { makeCode } from '~/app/(console)/invites/actions';
import { t } from '~/i18n/t';
import type { MakeCodeResult } from '~/lib/invites';
import { input, primaryButton } from '~/lib/styles';

const label = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 } as const;

/** New code (design: ModInviteCodes). The note is required and only moderators see it. */
export function MakeCodeForm() {
  const [state, action, pending] = useActionState<MakeCodeResult | null, FormData>(makeCode, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 110px minmax(160px, 1fr) auto', gap: 10 }}>
        <label style={label}>
          {t('invites.new.note')}
          <input name="note" required maxLength={200} style={{ ...input, minWidth: 0 }} />
        </label>
        <label style={label}>
          {t('invites.new.uses')}
          <input name="uses" type="number" required min={1} max={10000} defaultValue={1} style={input} />
        </label>
        <label style={label}>
          {t('invites.new.ends')}
          <input name="ends" type="date" style={{ ...input, minWidth: 0, width: '100%', boxSizing: 'border-box' }} />
        </label>
        <button
          type="submit"
          disabled={pending}
          style={{ ...primaryButton, fontSize: 14, minHeight: 44, alignSelf: 'end', opacity: pending ? 0.6 : 1 }}
        >
          {t('invites.new.button')}
        </button>
      </div>
      <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{t('invites.new.hint')}</p>
      {state?.result === 'made' ? (
        <p role="status" style={{ margin: 0, color: colors.brandText, fontSize: 13, fontWeight: 600 }}>
          {t('invites.new.made', { code: state.code })}
        </p>
      ) : state ? (
        <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: 13 }}>
          {t(`invites.new.errors.${state.result}`)}
        </p>
      ) : null}
    </form>
  );
}
