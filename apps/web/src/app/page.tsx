import { colors } from '@/theme/tokens';

import { Page } from '~/components/Page';
import { t } from '~/i18n/t';

export default function Home() {
  return (
    <Page appUrl="pickld://">
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{t('home.title')}</h1>
      <p style={{ margin: '0 0 8px', fontSize: 15, color: colors.inkSoft }}>{t('home.body')}</p>
    </Page>
  );
}
