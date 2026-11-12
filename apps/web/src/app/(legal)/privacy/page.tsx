import type { Metadata } from 'next';

import { LegalPage } from '~/components/LegalPage';
import { t } from '~/i18n/t';

export const metadata: Metadata = { title: t('legal.privacy') };

export default function Privacy() {
  return <LegalPage slug="privacy" />;
}
