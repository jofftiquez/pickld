'use client';

import { useActionState } from 'react';

import { colors, radius } from '@/theme/tokens';

import { createPack } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import { KEY_PART, type PackResult } from '~/lib/stickers';
import { input, primaryButton } from '~/lib/styles';

import { ResultNote } from './ResultNote';

const field = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 } as const;

/** A new free draft pack (FR-MOD-10). On success the action opens the pack. */
export function CreatePackForm() {
  const [result, action, pending] = useActionState<PackResult | null, FormData>(createPack, null);
  return (
    <form
      action={action}
      aria-label={t('stickers.create.title')}
      style={{ background: colors.surface, borderRadius: radius.card, padding: 16, display: 'grid', gap: 12 }}
    >
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('stickers.create.title')}</h2>
      <label style={field}>
        {t('stickers.create.name')}
        <input name="name" required maxLength={40} autoComplete="off" style={input} />
      </label>
      <label style={field}>
        {t('stickers.create.slug')}
        <input
          name="slug"
          required
          maxLength={40}
          pattern={KEY_PART}
          autoComplete="off"
          spellCheck={false}
          placeholder="summer-2027"
          style={input}
        />
        <span style={{ fontWeight: 400, color: colors.muted }}>{t('stickers.create.slugHint')}</span>
      </label>
      <label style={field}>
        {t('stickers.create.description')}
        <textarea name="description" maxLength={200} rows={2} style={{ ...input, fontSize: 14, resize: 'vertical' }} />
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{ ...primaryButton, fontSize: 14, minHeight: 44, justifySelf: 'start', opacity: pending ? 0.6 : 1 }}
      >
        {t('stickers.create.button')}
      </button>
      <ResultNote result={result} />
    </form>
  );
}
