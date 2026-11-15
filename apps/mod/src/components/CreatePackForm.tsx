'use client';

import { useActionState } from 'react';

import { createPack } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import { KEY_PART, type PackResult } from '~/lib/stickers';

import { Field } from './Field';
import { ResultNote } from './ResultNote';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

/** A new free draft pack (FR-MOD-10). On success the action opens the pack. */
export function CreatePackForm() {
  const [result, action, pending] = useActionState<PackResult | null, FormData>(createPack, null);
  return (
    <form
      action={action}
      aria-label={t('stickers.create.title')}
      className="grid gap-3 rounded-card border bg-card p-4 shadow-xs"
    >
      <h2 className="m-0 text-[17px] font-extrabold">{t('stickers.create.title')}</h2>
      <Field label={t('stickers.create.name')}>
        <Input name="name" required maxLength={40} autoComplete="off" />
      </Field>
      <Field label={t('stickers.create.slug')} hint={t('stickers.create.slugHint')}>
        <Input
          name="slug"
          required
          maxLength={40}
          pattern={KEY_PART}
          autoComplete="off"
          spellCheck={false}
          placeholder="summer-2027"
        />
      </Field>
      <Field label={t('stickers.create.description')}>
        <Textarea name="description" maxLength={200} rows={2} className="resize-y" />
      </Field>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t('stickers.create.button')}
      </Button>
      <ResultNote result={result} />
    </form>
  );
}
