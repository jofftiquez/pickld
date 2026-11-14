'use client';

import { useActionState } from 'react';

import { colors, radius } from '@/theme/tokens';

import { publishPack } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import type { PublishResult } from '~/lib/stickers';
import { primaryButton } from '~/lib/styles';

import { ResultNote } from './ResultNote';

/**
 * Publish a draft pack, after a confirm: it can't go back to draft (0100). Stays mounted once the pack is
 * published, so the confirmation shows after the page refreshes without the form.
 */
export function PublishForm({ pack, draft }: { pack: string; draft: boolean }) {
  const [result, action, pending] = useActionState<PublishResult | null, FormData>(publishPack, null);
  if (!draft) return result ? <ResultNote result={result} /> : null;
  return (
    <form
      action={action}
      aria-label={t('stickers.publish.title')}
      onSubmit={(e) => {
        if (!window.confirm(t('stickers.publish.confirm'))) e.preventDefault();
      }}
      style={{ background: colors.surface, borderRadius: radius.card, padding: 16, display: 'grid', gap: 10 }}
    >
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('stickers.publish.title')}</h2>
      <p style={{ margin: 0, color: colors.muted, fontSize: 14 }}>{t('stickers.publish.body')}</p>
      <input type="hidden" name="pack" value={pack} />
      <button
        type="submit"
        disabled={pending}
        style={{ ...primaryButton, fontSize: 14, minHeight: 44, justifySelf: 'start', opacity: pending ? 0.6 : 1 }}
      >
        {t('stickers.publish.button')}
      </button>
      <ResultNote result={result} />
    </form>
  );
}
