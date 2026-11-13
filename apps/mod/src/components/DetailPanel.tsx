import type { ReactNode } from 'react';

import { colors, radius } from '@/theme/tokens';

import { BlurredPhoto } from './BlurredPhoto';
import { SourceBadge } from './SourceBadge';
import { t } from '~/i18n/t';
import type { PhotoPair } from '~/lib/photos';
import { dayLabel, monthLabel, type QueueItem, reasonLabel } from '~/lib/queue';

function Fact({ label, strong, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <>
      <dt style={{ color: colors.muted }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: strong ? 700 : 400 }}>{children}</dd>
    </>
  );
}

function title(item: QueueItem): string {
  if (item.kind === 'moment' && item.slot) {
    return t('detail.title', { slot: item.slot, date: item.local_date ? dayLabel(item.local_date) : '' });
  }
  return t(`detail.${item.kind === 'moment' ? 'comment' : item.kind}`);
}

function flag(item: QueueItem): string {
  const reason = reasonLabel(item.reason);
  if (item.source === 'auto_check' && item.score !== null) {
    return t('detail.flagScore', { reason, score: item.score.toFixed(2) });
  }
  if (item.source === 'report') return t('detail.flagReports', { reason, count: item.report_count });
  if (item.source === 'appeal') return t('reason.removed', { reason: reason.toLowerCase() });
  return reason;
}

/** The right-hand panel (design: ModConsole): what the item is, the photo (blurred), and the facts. */
export function DetailPanel({ item, photo, actions }: { item: QueueItem; photo?: PhotoPair; actions?: ReactNode }) {
  const user = item.username ?? t('queue.noUser');
  return (
    <section
      aria-label={t('detail.label')}
      style={{
        background: colors.surface,
        borderRadius: radius.card,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title(item)}</h2>
        <SourceBadge item={item} />
      </header>
      {item.kind === 'moment' ? (
        <BlurredPhoto url={photo?.full ?? photo?.thumb ?? null} label={t('detail.photo', { slot: item.slot ?? '' })} />
      ) : item.comment_body ? (
        <blockquote
          style={{ margin: 0, padding: 16, background: colors.subtle, borderRadius: radius.thumbLg, fontSize: 15 }}
        >
          {item.comment_body}
        </blockquote>
      ) : null}
      <dl style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '6px 12px', margin: 0, fontSize: 13 }}>
        <Fact label={t('detail.flag')} strong>
          {flag(item)}
        </Fact>
        {item.kind === 'moment' ? (
          <Fact label={t('detail.caption')}>
            {item.caption ? t('detail.captionValue', { caption: item.caption }) : t('detail.noCaption')}
          </Fact>
        ) : null}
        {item.source === 'appeal' ? (
          <Fact label={t('detail.appeal')}>
            {item.appeal_message ? t('detail.captionValue', { caption: item.appeal_message }) : t('detail.noMessage')}
          </Fact>
        ) : null}
        <Fact label={t('detail.user')}>
          {item.username && item.owner_joined
            ? t('detail.userValue', { user, month: monthLabel(item.owner_joined), count: item.prior_removals })
            : user}
        </Fact>
        <Fact label={t('detail.visibility')}>
          {item.visible === null ? t('detail.notApplicable') : t(item.visible ? 'detail.visible' : 'detail.hidden')}
        </Fact>
      </dl>
      {actions}
    </section>
  );
}
