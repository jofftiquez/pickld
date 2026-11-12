import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';

export function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  const box = { width: size, height: size, borderRadius: '50%', flexShrink: 0 } as const;
  return url ? (
    <img src={url} alt={t('jar.avatar', { name })} style={{ ...box, objectFit: 'cover' }} />
  ) : (
    <span aria-hidden style={{ ...box, background: colors.brandTint }} />
  );
}
