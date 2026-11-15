'use client';

import { useActionState, useRef } from 'react';

import { uploadArt } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import { KEY_PART, nameFromFile, type UploadResult } from '~/lib/stickers';

import { Field } from './Field';
import { ResultNote } from './ResultNote';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * One PNG to the pack (FR-MOD-10). The name, which becomes the file name, starts as the chosen file's name.
 * fn:sticker-studio checks the PNG and its size again and decides whether it adds or replaces.
 */
export function UploadArtForm({ pack, draft }: { pack: string; draft: boolean }) {
  const [result, action, pending] = useActionState<UploadResult | null, FormData>(uploadArt, null);
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <form
      action={action}
      aria-label={t(draft ? 'stickers.upload.titleDraft' : 'stickers.upload.title')}
      className="grid gap-3 rounded-card border bg-card p-4 shadow-xs"
    >
      <h2 className="m-0 text-[17px] font-extrabold">
        {t(draft ? 'stickers.upload.titleDraft' : 'stickers.upload.title')}
      </h2>
      <input type="hidden" name="pack" value={pack} />
      <Field label={t('stickers.upload.file')} hint={t('stickers.upload.fileHint')}>
        <Input
          type="file"
          name="file"
          required
          accept="image/png"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file && nameRef.current && nameRef.current.value === '')
              nameRef.current.value = nameFromFile(file.name);
          }}
          className="pt-2"
        />
      </Field>
      <Field label={t('stickers.upload.name')} hint={draft ? t('stickers.upload.nameHint') : undefined}>
        <Input
          ref={nameRef}
          name="name"
          required
          maxLength={60}
          pattern={KEY_PART}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Field label={t('stickers.upload.label')}>
        <Input name="label" maxLength={40} autoComplete="off" />
      </Field>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t('stickers.upload.button')}
      </Button>
      <ResultNote result={result} />
    </form>
  );
}
