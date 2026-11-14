import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { SourceBadge } from './SourceBadge';
import { t } from '~/i18n/t';
import type { PhotoPair } from '~/lib/photos';
import { type Filter, type QueueItem, reasonLabel, waitedSeconds, waitLabel } from '~/lib/queue';

const grid = { display: 'grid', gridTemplateColumns: '64px 110px 1fr 140px 64px', alignItems: 'center', gap: 12 };

function reason(item: QueueItem): string {
  const label = reasonLabel(item.reason);
  return item.source === 'appeal' ? t('reason.removed', { reason: label.toLowerCase() }) : label;
}

/** The queue table (design: ModConsole). Thumbnails are always blurred here; the panel can show a photo. */
export function QueueList({
  items,
  photos,
  selected,
  filter,
  now,
}: {
  items: QueueItem[];
  photos: Map<string, PhotoPair>;
  selected: string | null;
  filter: Filter;
  now: number;
}) {
  return (
    <section style={{ background: colors.surface, borderRadius: radius.card, overflow: 'hidden', minWidth: 0 }}>
      <div
        aria-hidden
        style={{
          ...grid,
          padding: '12px 14px',
          fontSize: 12,
          fontWeight: 700,
          color: colors.muted,
          borderBottom: `1px solid ${colors.divider}`,
        }}
      >
        <span>{t('queue.columns.item')}</span>
        <span>{t('queue.columns.source')}</span>
        <span>{t('queue.columns.reason')}</span>
        <span>{t('queue.columns.user')}</span>
        <span style={{ textAlign: 'right' }}>{t('queue.columns.waiting')}</span>
      </div>
      {items.length === 0 ? (
        <p style={{ padding: 24, margin: 0, color: colors.muted }}>{t('queue.empty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item) => {
            const thumb = item.moment_id ? photos.get(item.moment_id)?.thumb : null;
            const wait = waitLabel(waitedSeconds(item.created_at, now));
            const user = item.username ?? t('queue.noUser');
            const active = item.id === selected;
            return (
              <li key={item.id} style={{ borderBottom: `1px solid ${colors.divider}` }}>
                <Link
                  href={`/queue?filter=${filter}&item=${item.id}`}
                  aria-current={active ? 'true' : undefined}
                  aria-label={t('queue.rowLabel', { reason: reason(item), user, wait })}
                  scroll={false}
                  style={{
                    ...grid,
                    padding: '10px 14px',
                    textDecoration: 'none',
                    color: colors.ink,
                    background: active ? colors.rowSelected : 'transparent',
                  }}
                >
                  <span
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
                  </span>
                  <span>
                    <SourceBadge item={item} />
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{reason(item)}</span>
                  <span style={{ color: colors.muted, fontSize: 14 }}>@{user}</span>
                  <span style={{ textAlign: 'right', color: colors.muted, fontSize: 14 }}>{wait}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
