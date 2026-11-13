import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';

export default function Queue() {
  return (
    <header>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('queue.title')}</h1>
      <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('queue.subtitle')}</p>
    </header>
  );
}
