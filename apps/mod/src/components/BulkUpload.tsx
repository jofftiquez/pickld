'use client';

import { useRouter } from 'next/navigation';
import { type DragEvent, useState } from 'react';

import { colors, radius } from '@/theme/tokens';

import { uploadArtBulk } from '~/app/(console)/stickers/actions';
import { t } from '~/i18n/t';
import { checkArt, MAX_BULK_FILES, nameFromFile, uniqueName, type UploadResult } from '~/lib/stickers';
import { secondaryButton } from '~/lib/styles';

type Row = {
  file: string;
  name: string;
  renamed: boolean;
  state: 'waiting' | 'uploading' | 'added' | 'refused';
  reason?: string;
};

const hidden = { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' } as const;

/**
 * Many PNGs into a draft pack at once (FR-MOD-10), by drop or file picker. Each file is checked here (PNG,
 * 2048 px, 2 MB) and again by fn:sticker-studio, and always becomes a new sticker named after its file:
 * a name already in the pack or the drop gets -2, -3…, so a bulk drop never replaces art. Refused files stay
 * listed with the reason. The stickers are then edited one by one in the list below.
 */
export function BulkUpload({ pack, taken }: { pack: string; taken: string[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const update = (index: number, change: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  async function start(files: File[]) {
    if (busy || files.length === 0) return;
    setBusy(true);
    const names = new Set(taken);
    const list: Row[] = [];
    const jobs: { index: number; file: File; name: string }[] = [];
    for (const [i, file] of files.entries()) {
      const base = nameFromFile(file.name);
      const problem = i >= MAX_BULK_FILES ? 'too_many' : await checkArt(file);
      if (problem) {
        list.push({ file: file.name, name: base, renamed: false, state: 'refused', reason: problem });
        continue;
      }
      const name = uniqueName(base, names);
      list.push({ file: file.name, name, renamed: base !== '' && name !== base, state: 'waiting' });
      jobs.push({ index: list.length - 1, file, name });
    }
    setRows(list);
    // One at a time, so the stickers keep the drop's order (each new sticker goes to the end of the pack).
    for (const job of jobs) {
      update(job.index, { state: 'uploading' });
      const form = new FormData();
      form.set('pack', pack);
      form.set('name', job.name);
      form.set('file', job.file);
      let result: UploadResult;
      try {
        result = await uploadArtBulk(form);
      } catch {
        result = 'unavailable';
      }
      update(job.index, result === 'added' ? { state: 'added' } : { state: 'refused', reason: result });
    }
    setBusy(false);
    router.refresh();
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    void start(Array.from(e.dataTransfer.files));
  }

  const added = rows.filter((r) => r.state === 'added').length;
  const refused = rows.filter((r) => r.state === 'refused').length;
  const finished = added + refused;

  return (
    <section
      aria-label={t('stickers.bulk.title')}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        display: 'grid',
        gap: 10,
        padding: 16,
        borderRadius: radius.card,
        background: dragging ? colors.brandTint : colors.surface,
        border: `2px dashed ${dragging ? colors.brand : colors.border}`,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('stickers.bulk.title')}</h2>
      <p style={{ margin: 0, fontSize: 14 }}>{t('stickers.bulk.body')}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label
          style={{
            ...secondaryButton,
            position: 'relative',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {t('stickers.bulk.choose')}
          <input
            type="file"
            multiple
            accept="image/png"
            disabled={busy}
            aria-label={t('stickers.bulk.files')}
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = '';
              void start(files);
            }}
            style={hidden}
          />
        </label>
        <span style={{ fontSize: 13, color: colors.muted }}>{t('stickers.bulk.limits')}</span>
      </div>
      {rows.length > 0 ? (
        <>
          <p role="status" style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            {busy
              ? t('stickers.bulk.progress', { done: finished, total: rows.length })
              : t('stickers.bulk.done', { added, refused })}
          </p>
          <ul
            aria-label={t('stickers.bulk.list')}
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', maxHeight: 320, overflowY: 'auto' }}
          >
            {rows.map((row, i) => (
              <li
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 12,
                  padding: '8px 0',
                  borderTop: `1px solid ${colors.divider}`,
                  fontSize: 13,
                }}
              >
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <span style={{ fontWeight: 700 }}>{row.file}</span>
                  {row.state !== 'refused' ? (
                    <span style={{ color: colors.muted }}>
                      {' → '}
                      {row.name}
                      {row.renamed ? ` (${t('stickers.bulk.renamed')})` : ''}
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontWeight: row.state === 'added' ? 700 : 400,
                    color:
                      row.state === 'refused' ? colors.danger : row.state === 'added' ? colors.brandText : colors.muted,
                  }}
                >
                  {row.state === 'refused'
                    ? t(`stickers.results.${row.reason ?? 'unknown'}`)
                    : t(`stickers.bulk.${row.state}`)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
