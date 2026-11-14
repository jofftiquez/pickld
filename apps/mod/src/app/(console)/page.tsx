import Link from 'next/link';
import type { ReactNode } from 'react';

import { colors, radius } from '@/theme/tokens';

import { Tile } from '~/components/Tile';
import { t } from '~/i18n/t';
import { env } from '~/lib/env';
import { loadOverview } from '~/lib/overview';
import { waitLabel } from '~/lib/queue';
import { supabase } from '~/lib/supabase';

const TWO_HOURS = 2 * 60 * 60;

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 10 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
        {action}
      </header>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
          margin: 0,
        }}
      >
        {children}
      </dl>
    </section>
  );
}

const link = { color: colors.brandLink, fontWeight: 700, fontSize: 14 } as const;

// The console's home (FR-MOD-06): is the queue keeping up, what happened today (Manila time), and is the app
// healthy. Every number is a count from mod_overview(); nothing here shows a photo or a caption.
export default async function Overview() {
  const data = await loadOverview(await supabase());
  const { queue, today, people, suspended } = data;
  const uploadsUrl = env().POSTHOG_UPLOADS_URL;
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('overview.title')}</h1>
        <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('overview.subtitle', { date })}</p>
      </header>

      {queue.over_two_hours > 0 ? (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: '12px 16px',
            borderRadius: radius.thumbLg,
            background: colors.dangerTint,
            color: colors.likeText,
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {t('overview.queue.late', { count: queue.over_two_hours })}
          <Link href="/queue" style={{ color: colors.likeText }}>
            {t('overview.queue.open')}
          </Link>
        </p>
      ) : null}

      <Section
        title={t('overview.queue.title')}
        action={
          <Link href="/queue" style={link}>
            {t('overview.queue.open')}
          </Link>
        }
      >
        <Tile
          label={t('overview.queue.waiting')}
          value={String(queue.open)}
          hint={t('overview.queue.escalated', { count: queue.escalated })}
        />
        <Tile
          label={t('overview.queue.oldest')}
          value={queue.open > 0 ? waitLabel(queue.oldest_seconds) : '—'}
          alert={queue.oldest_seconds > TWO_HOURS}
        />
        <Tile label={t('overview.queue.median')} value={queue.open > 0 ? waitLabel(queue.median_wait_seconds) : '—'} />
        <Tile
          label={t('overview.queue.overTwoHours')}
          value={String(queue.over_two_hours)}
          alert={queue.over_two_hours > 0}
        />
      </Section>

      <Section title={t('overview.today.title')}>
        <Tile label={t('overview.today.reports')} value={String(today.reports)} />
        <Tile
          label={t('overview.today.appeals')}
          value={String(today.appeals_opened)}
          hint={t('overview.today.appealsDecided', { count: today.appeals_decided })}
        />
        <Tile label={t('overview.today.removedAuto')} value={String(today.removed_auto)} />
        <Tile label={t('overview.today.removedByModerators')} value={String(today.removed_by_moderators)} />
        <Tile label={t('overview.today.kept')} value={String(today.kept)} />
        <Tile label={t('overview.today.suspensions')} value={String(today.suspensions)} />
      </Section>

      <section aria-label={t('overview.decisions.title')} style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('overview.decisions.title')}</h2>
        <div style={{ background: colors.surface, borderRadius: radius.card, padding: '6px 16px' }}>
          {today.decisions.length === 0 ? (
            <p style={{ margin: '10px 0', color: colors.muted, fontSize: 14 }}>{t('overview.decisions.empty')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {today.decisions.map((d, i) => (
                <li
                  key={d.username}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    fontSize: 14,
                    borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>@{d.username}</span>
                  <span style={{ color: colors.muted }}>{t('overview.decisions.count', { count: d.count })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Section title={t('overview.people.title')}>
        <Tile
          label={t('overview.people.signups')}
          value={String(people.signups_today)}
          hint={t('overview.people.week', { count: people.signups_week })}
        />
        <Tile
          label={t('overview.people.posted')}
          value={String(people.posted_today)}
          hint={t('overview.people.week', { count: people.posted_week })}
        />
        <Tile label={t('overview.people.moments')} value={String(people.moments_today)} />
        <Tile
          label={t('overview.people.suspended')}
          value={String(suspended.total)}
          hint={t('overview.people.childSafety', { count: suspended.child_safety })}
        />
      </Section>

      <Section
        title={t('overview.uploads.title')}
        action={
          uploadsUrl ? (
            <a href={uploadsUrl} target="_blank" rel="noreferrer" style={link}>
              {t('overview.uploads.posthog')}
            </a>
          ) : (
            <span style={{ color: colors.muted, fontSize: 13 }}>{t('overview.uploads.posthogMissing')}</span>
          )
        }
      >
        <Tile
          label={t('overview.uploads.stuck')}
          value={String(data.stuck_uploads)}
          hint={t('overview.uploads.stuckHint')}
          alert={data.stuck_uploads > 0}
        />
      </Section>
    </div>
  );
}
