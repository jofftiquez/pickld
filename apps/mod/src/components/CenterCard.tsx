import type { ReactNode } from 'react';

import { colors, radius } from '@/theme/tokens';

import { Mark } from './Mark';
import { t } from '~/i18n/t';

/** A single card in the middle of the page, for sign-in and access denied. */
export function CenterCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}>
      <section
        style={{ background: colors.surface, borderRadius: radius.card, padding: 32, width: '100%', maxWidth: 420 }}
      >
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 24px', fontWeight: 800 }}>
          <Mark />
          {t('site.name')}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>{title}</h1>
        {children}
      </section>
    </main>
  );
}
