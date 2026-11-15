import { t } from '~/i18n/t';

import { FormNote } from './Field';

const GOOD = new Set(['created', 'saved', 'published', 'retired', 'restored', 'unchanged', 'added', 'replaced']);

/** What a Sticker Studio form did: a status line when it worked, an alert when it didn't. */
export function ResultNote({ result }: { result: string | null }) {
  if (!result) return null;
  return <FormNote tone={GOOD.has(result) ? 'ok' : 'error'}>{t(`stickers.results.${result}`)}</FormNote>;
}
