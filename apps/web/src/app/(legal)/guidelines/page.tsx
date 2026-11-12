import type { Metadata } from 'next';

import { LegalPage } from '~/components/LegalPage';
import { t } from '~/i18n/t';

export const metadata: Metadata = { title: t('legal.guidelines') };

export default function Guidelines() {
  return <LegalPage slug="guidelines" />;
}
