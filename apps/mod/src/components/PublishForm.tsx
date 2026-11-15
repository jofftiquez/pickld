'use client';

import { useActionState } from 'react';

import { publishPack } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import type { PublishResult } from '~/lib/stickers';

import { ResultNote } from './ResultNote';
import { Button } from './ui/button';

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
      className="grid gap-2.5 rounded-card border bg-card p-4 shadow-xs"
    >
      <h2 className="m-0 text-[17px] font-extrabold">{t('stickers.publish.title')}</h2>
      <p className="m-0 text-sm text-muted-foreground">{t('stickers.publish.body')}</p>
      <input type="hidden" name="pack" value={pack} />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t('stickers.publish.button')}
      </Button>
      <ResultNote result={result} />
    </form>
  );
}
