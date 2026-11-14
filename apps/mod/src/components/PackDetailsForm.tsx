'use client';

import { useActionState } from 'react';

import { colors } from '@/theme/tokens';

import { editPack } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import type { PackResult } from '~/lib/stickers';
import { input, secondaryButton } from '~/lib/styles';

import { ResultNote } from './ResultNote';

const field = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 } as const;

/** A free pack's name and description. The short name is its key prefix, so it never changes. */
export function PackDetailsForm({ pack, name, description }: { pack: string; name: string; description: string }) {
  const [result, action, pending] = useActionState<PackResult | null, FormData>(editPack, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      <input type="hidden" name="pack" value={pack} />
      <label style={field}>
        {t('stickers.create.name')}
        <input name="name" required maxLength={40} defaultValue={name} autoComplete="off" style={input} />
      </label>
      <label style={field}>
        {t('stickers.create.description')}
        <textarea
          name="description"
          maxLength={200}
          rows={2}
          defaultValue={description}
          style={{ ...input, fontSize: 14, resize: 'vertical', color: colors.ink }}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{ ...secondaryButton, minHeight: 44, justifySelf: 'start', opacity: pending ? 0.6 : 1 }}
      >
        {t('stickers.pack.save')}
      </button>
      <ResultNote result={result} />
    </form>
  );
}
