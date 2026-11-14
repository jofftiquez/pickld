import { colors } from '@/theme/tokens';

import { Card } from '~/components/Card';
import { t } from '~/i18n/t';

const bar = (width: number | string, height = 12) => (
  <span className="skeleton" style={{ display: 'block', width, height }} />
);

// What a console page shows while its data loads: the shape of a header and a table.
export default function Loading() {
  return (
    <div role="status" aria-label={t('table.loading')} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {bar(220, 26)}
        {bar(320)}
      </div>
      <Card>
        <div style={{ padding: '14px', borderBottom: `1px solid ${colors.divider}` }}>{bar(160)}</div>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 80px',
              gap: 16,
              padding: '16px 14px',
              borderBottom: `1px solid ${colors.divider}`,
            }}
          >
            {bar('70%')}
            {bar('60%')}
            {bar('50%')}
            {bar('100%')}
          </div>
        ))}
      </Card>
    </div>
  );
}
