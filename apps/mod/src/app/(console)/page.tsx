import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { Decisions } from '~/components/Decisions';
import { DetailPanel } from '~/components/DetailPanel';
import { QueueList } from '~/components/QueueList';
import { t } from '~/i18n/t';
import { defaultGuideline } from '~/lib/decide';
import { photoUrls } from '~/lib/photos';
import { FILTERS, FilterParam, loadQueue, loadStats, waitLabel } from '~/lib/queue';
import { supabase } from '~/lib/supabase';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.thumbLg,
        padding: '8px 14px',
        minWidth: 72,
        display: 'flex',
        flexDirection: 'column-reverse',
      }}
    >
      <dt style={{ color: colors.muted, fontSize: 11 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{value}</dd>
    </div>
  );
}

// The review queue (FR-MOD-02, FR-MOD-03; design: ModConsole). Oldest first; ?filter= picks a source and
// ?item= opens one in the panel, where Keep / Remove / Escalate (and K, R, E) decide it.
export default async function Queue({ searchParams }: { searchParams: Promise<{ filter?: string; item?: string }> }) {
  const params = await searchParams;
  const filter = FilterParam.parse(params.filter);
  const client = await supabase();
  const [items, stats] = await Promise.all([loadQueue(client, filter), loadStats(client)]);
  const selected = items.find((i) => i.id === params.item) ?? items[0] ?? null;
  const momentIds = [...new Set(items.flatMap((i) => (i.moment_id ? [i.moment_id] : [])))];
  const photos = await photoUrls(client, momentIds);
  // A server render's clock; waits only need minute precision.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('queue.title')}</h1>
          <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('queue.subtitle')}</p>
        </div>
        <dl aria-label={t('queue.stats.label')} style={{ display: 'flex', gap: 10, margin: 0 }}>
          <Stat label={t('queue.stats.pending')} value={String(stats.pending)} />
          <Stat label={t('queue.stats.wait')} value={waitLabel(stats.median_wait_seconds)} />
          <Stat label={t('queue.stats.appeals')} value={String(stats.open_appeals)} />
        </dl>
      </header>
      <nav aria-label={t('queue.filters.label')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Link
              key={f}
              href={f === 'all' ? '/' : `/?filter=${f}`}
              aria-current={active ? 'true' : undefined}
              style={{
                padding: '8px 14px',
                minHeight: 44,
                border: `1px solid ${active ? colors.ink : colors.divider}`,
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: radius.pill,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                background: active ? colors.ink : colors.surface,
                color: active ? colors.surface : colors.ink,
              }}
            >
              {t(`queue.filters.${f}`)}
            </Link>
          );
        })}
      </nav>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 16, alignItems: 'start' }}>
        <QueueList items={items} photos={photos} selected={selected?.id ?? null} filter={filter} now={now} />
        {selected ? (
          <DetailPanel
            key={selected.id}
            item={selected}
            photo={selected.moment_id ? photos.get(selected.moment_id) : undefined}
            actions={<Decisions item={selected} filter={filter} initialGuideline={defaultGuideline(selected)} />}
          />
        ) : null}
      </div>
    </div>
  );
}
