'use client';

import { useActionState, useRef } from 'react';

import { colors, radius } from '@/theme/tokens';

import { uploadArt } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import { KEY_PART, nameFromFile, type UploadResult } from '~/lib/stickers';
import { input, primaryButton } from '~/lib/styles';

import { ResultNote } from './ResultNote';

const field = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 } as const;
const hint = { fontWeight: 400, color: colors.muted } as const;

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
      style={{ background: colors.surface, borderRadius: radius.card, padding: 16, display: 'grid', gap: 12 }}
    >
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
        {t(draft ? 'stickers.upload.titleDraft' : 'stickers.upload.title')}
      </h2>
      <input type="hidden" name="pack" value={pack} />
      <label style={field}>
        {t('stickers.upload.file')}
        <input
          type="file"
          name="file"
          required
          accept="image/png"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file && nameRef.current && nameRef.current.value === '')
              nameRef.current.value = nameFromFile(file.name);
          }}
          style={{ fontSize: 14 }}
        />
        <span style={hint}>{t('stickers.upload.fileHint')}</span>
      </label>
      <label style={field}>
        {t('stickers.upload.name')}
        <input
          ref={nameRef}
          name="name"
          required
          maxLength={60}
          pattern={KEY_PART}
          autoComplete="off"
          spellCheck={false}
          style={input}
        />
        {draft ? <span style={hint}>{t('stickers.upload.nameHint')}</span> : null}
      </label>
      <label style={field}>
        {t('stickers.upload.label')}
        <input name="label" maxLength={40} autoComplete="off" style={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{ ...primaryButton, fontSize: 14, minHeight: 44, justifySelf: 'start', opacity: pending ? 0.6 : 1 }}
      >
        {t('stickers.upload.button')}
      </button>
      <ResultNote result={result} />
    </form>
  );
}
