import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';

const GOOD = new Set(['created', 'saved', 'published', 'retired', 'restored', 'unchanged', 'added', 'replaced']);

/** What a Sticker Studio form did: a status line when it worked, an alert when it didn't. */
export function ResultNote({ result }: { result: string | null }) {
  if (!result) return null;
  const good = GOOD.has(result);
  return (
    <p
      role={good ? 'status' : 'alert'}
      style={{ margin: 0, fontSize: 13, color: good ? colors.brandText : colors.danger, fontWeight: good ? 600 : 400 }}
    >
      {t(`stickers.results.${result}`)}
    </p>
  );
}
