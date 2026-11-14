import { colors } from '@/theme/tokens';

import { Card } from '~/components/Card';
import { CreatePackForm } from '~/components/CreatePackForm';
import { PageHeader } from '~/components/PageHeader';
import { Pagination } from '~/components/Pagination';
import { StatusPill } from '~/components/StatusPill';
import { Table } from '~/components/Table';
import { t } from '~/i18n/t';
import { loadPackThumbs } from '~/lib/analytics';
import { lastPage, readPaging, withParams } from '~/lib/paging';
import { EDITABLE_TIER, loadPacks } from '~/lib/stickers';
import { supabase } from '~/lib/supabase';

const SORTS = ['pack', 'stickers', 'likes'] as const;
type Sort = (typeof SORTS)[number];

// The Sticker Studio's pack list (FR-MOD-10; design: ModConsole lists "Sticker packs"): every pack, drafts
// first unless sorted by a column, a page at a time, and a form for a new free draft pack.
export default async function StickerPacks({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const key = (SORTS as readonly string[]).includes(params.sort ?? '') ? (params.sort as Sort) : null;
  const dir =
    key === null
      ? 'asc'
      : params.dir === 'asc'
        ? 'asc'
        : params.dir === 'desc'
          ? 'desc'
          : key === 'pack'
            ? 'asc'
            : 'desc';
  const paging = readPaging(params);
  const client = await supabase();
  const [packs, thumbs] = await Promise.all([loadPacks(client), loadPackThumbs(client, 30)]);
  const likes = (id: string) => thumbs.get(id)?.thumbs ?? 0;
  const sorted =
    key === null
      ? packs
      : [...packs].sort((a, b) => {
          const order =
            key === 'pack'
              ? a.name.localeCompare(b.name)
              : key === 'stickers'
                ? a.live - b.live
                : likes(a.id) - likes(b.id);
          return (dir === 'asc' ? order : -order) || a.name.localeCompare(b.name);
        });
  const page = Math.min(paging.page, lastPage(sorted.length, paging.size));
  const shown = sorted.slice((page - 1) * paging.size, page * paging.size);
  const query = {
    sort: key ?? undefined,
    dir: key ? dir : undefined,
    size: paging.size !== 25 ? String(paging.size) : undefined,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageHeader title={t('stickers.title')} subtitle={t('stickers.subtitle')} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <Card label={t('stickers.list.label')}>
          <Table
            columns={[
              { key: 'pack', label: t('stickers.list.pack'), sortable: true, firstDir: 'asc' },
              { key: 'tier', label: t('stickers.list.tier'), width: 100 },
              { key: 'status', label: t('stickers.list.status'), width: 110 },
              {
                key: 'stickers',
                label: t('stickers.list.stickers'),
                width: 110,
                align: 'right',
                sortable: true,
                firstDir: 'desc',
              },
              {
                key: 'likes',
                label: t('stickers.list.thumbs'),
                width: 100,
                align: 'right',
                sortable: true,
                firstDir: 'desc',
              },
            ]}
            sort={key ? { key, dir } : undefined}
            sortHref={(k, d) => withParams('/stickers', query, { sort: k, dir: d, page: null })}
            empty={t('stickers.list.empty')}
            rows={shown.map((p) => ({
              key: p.id,
              href: `/stickers/${p.id}`,
              linkLabel: t('stickers.list.rowLabel', { name: p.name, status: t(`stickers.status.${p.status}`) }),
              cells: [
                <span key="pack" style={{ display: 'block', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, display: 'block' }}>{p.name}</span>
                  <span style={{ color: colors.muted, fontSize: 12, fontWeight: 500 }}>
                    {p.slug}
                    {p.tier !== EDITABLE_TIER ? ` · ${t('stickers.list.readOnly')}` : ''}
                  </span>
                </span>,
                <span key="tier" style={{ color: colors.muted }}>
                  {t(`stickers.tier.${p.tier}`)}
                </span>,
                <StatusPill key="status" status={p.status} />,
                <span key="stickers">
                  {p.live}
                  {p.retired > 0 ? (
                    <span style={{ display: 'block', color: colors.muted, fontSize: 12 }}>
                      {t('stickers.list.retiredCount', { count: p.retired })}
                    </span>
                  ) : null}
                </span>,
                <span key="likes" data-likes="">
                  {likes(p.id)}
                </span>,
              ],
            }))}
          />
          <Pagination total={sorted.length} page={page} size={paging.size} path="/stickers" params={query} />
        </Card>
        <div>
          <CreatePackForm />
        </div>
      </div>
    </div>
  );
}
