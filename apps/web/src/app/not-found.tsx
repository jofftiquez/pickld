import Link from 'next/link';

import { colors } from '@/theme/tokens';

import { Page } from '~/components/Page';
import { t } from '~/i18n/t';

export default function NotFound() {
  return (
    <Page appUrl="pickld://">
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{t('notFound.title')}</h1>
      <p style={{ margin: 0, fontSize: 14, color: colors.inkSoft }}>{t('notFound.body')}</p>
      <p style={{ margin: '0 0 8px', fontSize: 14 }}>
        <Link href="/">{t('notFound.home')}</Link>
      </p>
    </Page>
  );
}
