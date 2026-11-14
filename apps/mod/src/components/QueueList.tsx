import { colors, radius } from '@/theme/tokens';

import { Card } from './Card';
import { Pagination } from './Pagination';
import { SourceBadge } from './SourceBadge';
import { Table } from './Table';
import { t } from '~/i18n/t';
import { type Dir, withParams } from '~/lib/paging';
import type { PhotoPair } from '~/lib/photos';
import { type QueueItem, reasonLabel, waitedSeconds, waitLabel } from '~/lib/queue';

function reason(item: QueueItem): string {
  const label = reasonLabel(item.reason);
  return item.source === 'appeal' ? t('reason.removed', { reason: label.toLowerCase() }) : label;
}

/**
 * The queue table (design: ModConsole), one page at a time. Thumbnails are always blurred here; the panel can
 * show a photo. `params` are the page's query (filter, page, size, sort), kept by every link.
 */
export function QueueList({
  items,
  photos,
  selected,
  params,
  total,
  page,
  size,
  dir,
  now,
}: {
  items: QueueItem[];
  photos: Map<string, PhotoPair>;
  selected: string | null;
  params: Record<string, string | undefined>;
  total: number;
  page: number;
  size: number;
  dir: Dir;
  now: number;
}) {
  return (
    <Card label={t('queue.label')}>
      <Table
        columns={[
          { key: 'item', label: t('queue.columns.item'), width: 64 },
          { key: 'source', label: t('queue.columns.source'), width: 120 },
          { key: 'reason', label: t('queue.columns.reason') },
          { key: 'user', label: t('queue.columns.user'), width: 160 },
          {
            key: 'waiting',
            label: t('queue.columns.waiting'),
            width: 96,
            align: 'right',
            sortable: true,
            firstDir: 'desc',
          },
        ]}
        sort={{ key: 'waiting', dir }}
        sortHref={(_key, next) =>
          withParams('/queue', params, { dir: next === 'desc' ? null : next, page: null, item: null })
        }
        empty={t('queue.empty')}
        rows={items.map((item) => {
          const thumb = item.moment_id ? photos.get(item.moment_id)?.thumb : null;
          const wait = waitLabel(waitedSeconds(item.created_at, now));
          const user = item.username ?? t('queue.noUser');
          return {
            key: item.id,
            selected: item.id === selected,
            href: withParams('/queue', params, { item: item.id }),
            linkLabel: t('queue.rowLabel', { reason: reason(item), user, wait }),
            cells: [
              <span
                key="thumb"
                style={{
                  width: 36,
                  height: 48,
                  borderRadius: radius.thumb,
                  overflow: 'hidden',
                  background: colors.photoPlaceholder,
                  display: 'block',
                }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'blur(5px)',
                      transform: 'scale(1.2)',
                    }}
                  />
                ) : null}
              </span>,
              <SourceBadge key="source" item={item} />,
              <span key="reason" style={{ fontWeight: 700 }}>
                {reason(item)}
              </span>,
              <span key="user" style={{ color: colors.muted }}>
                @{user}
              </span>,
              <span key="wait" style={{ color: colors.muted }}>
                {wait}
              </span>,
            ],
          };
        })}
      />
      <Pagination total={total} page={page} size={size} path="/queue" params={{ ...params, item: undefined }} />
    </Card>
  );
}
