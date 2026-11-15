'use client';

import { useActionState } from 'react';

import { editPack } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import type { PackResult } from '~/lib/stickers';

import { Field } from './Field';
import { ResultNote } from './ResultNote';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

/** A free pack's name and description. The short name is its key prefix, so it never changes. */
export function PackDetailsForm({ pack, name, description }: { pack: string; name: string; description: string }) {
  const [result, action, pending] = useActionState<PackResult | null, FormData>(editPack, null);
  return (
    <form action={action} className="grid gap-2.5">
      <input type="hidden" name="pack" value={pack} />
      <Field label={t('stickers.create.name')}>
        <Input name="name" required maxLength={40} defaultValue={name} autoComplete="off" />
      </Field>
      <Field label={t('stickers.create.description')}>
        <Textarea name="description" maxLength={200} rows={2} defaultValue={description} className="resize-y" />
      </Field>
      <Button type="submit" disabled={pending} variant="secondary" className="justify-self-start">
        {t('stickers.pack.save')}
      </Button>
      <ResultNote result={result} />
    </form>
  );
}
