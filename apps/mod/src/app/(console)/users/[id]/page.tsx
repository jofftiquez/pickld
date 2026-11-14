import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { colors, radius } from '@/theme/tokens';

import { BarList } from '~/components/BarList';
import { BlurredPhoto } from '~/components/BlurredPhoto';
import { DayBars } from '~/components/DayBars';
import { SuspendForm } from '~/components/SuspendForm';
import { Tile } from '~/components/Tile';
import { t } from '~/i18n/t';
import { loadUserStats } from '~/lib/analytics';
import { actionLabel, details, when } from '~/lib/audit';
import { photoUrls } from '~/lib/photos';
import { dayLabel, monthLabel, reasonLabel } from '~/lib/queue';
import { supabase } from '~/lib/supabase';
import { loadUser, loadUserMoments, type UserDetail } from '~/lib/users';

const card = { background: colors.surface, borderRadius: radius.card, padding: 16 } as const;
const row = { padding: '10px 0', fontSize: 14, borderTop: `1px solid ${colors.divider}` } as const;

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} style={{ ...card, display: 'grid', gap: 8, alignContent: 'start' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, color: colors.muted, fontSize: 14 }}>{children}</p>;
}

function statusText(u: UserDetail): string {
  const s = u.suspension;
  if (!s) return t(`users.status.${u.profile.status}`);
  if (s.kind === 'child_safety') return t('users.status.childSafety');
  return t('users.status.suspendedUntil', { date: s.until ? when(s.until) : '' });
}

// One account (FR-MOD-07): who they are, whether they're suspended and why, their strikes, moments (blurred),
// reports, and every moderation action about them. Suspend and lift go through mod_suspend() and
// mod_lift_suspension() as the moderator (D-132).
export default async function User({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id).data;
  if (!id) notFound();
  const client = await supabase();
  const [user, moments, usage] = await Promise.all([
    loadUser(client, id),
    loadUserMoments(client, id),
    loadUserStats(client, id),
  ]);
  if (!user) notFound();
  const photos = await photoUrls(
    client,
    moments.map((m) => m.id),
  );
  const { profile, suspension, strikes } = user;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1100 }}>
      <nav style={{ fontSize: 14 }}>
        <Link href="/users" style={{ color: colors.brandLink, fontWeight: 700 }}>
          {t('users.back')}
        </Link>
      </nav>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>@{profile.username}</h1>
          <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>
            {t('users.headline', {
              name: profile.display_name,
              month: monthLabel(profile.created_at),
              email: profile.email ?? t('users.noEmail'),
            })}
          </p>
          {profile.bio ? <p style={{ margin: '8px 0 0', fontSize: 14 }}>{profile.bio}</p> : null}
        </div>
        <span
          style={{
            borderRadius: radius.pill,
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            background: suspension ? colors.dangerTint : colors.brandTint,
            color: suspension ? colors.likeText : colors.brandText,
          }}
        >
          {statusText(user)}
        </span>
      </header>

      <dl
        aria-label={t('users.summary')}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, margin: 0 }}
      >
        <Tile
          label={t('users.tiles.moments')}
          value={String(user.moments.total)}
          hint={t('users.tiles.momentsHint', { live: user.moments.live, removed: user.moments.removed })}
        />
        <Tile label={t('users.tiles.strikes')} value={String(strikes.count)} alert={strikes.count >= 3} />
        <Tile label={t('users.tiles.reportsAgainst')} value={String(user.reports_against.length)} />
        <Tile
          label={t('users.tiles.reportsFiled')}
          value={String(user.reports_filed.total)}
          hint={t('users.tiles.week', { count: user.reports_filed.week })}
        />
        <Tile
          label={t('users.tiles.readers')}
          value={String(profile.reader_count)}
          hint={t('users.tiles.authors', { count: profile.author_count })}
        />
        <Tile label={t('users.tiles.jars')} value={String(profile.jar_count)} hint={profile.home_tz ?? undefined} />
      </dl>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <Card title={t('users.strikes.title')}>
            {strikes.items.length === 0 ? (
              <Empty>{t('users.strikes.empty')}</Empty>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {strikes.items.map((s) => (
                  <li key={s.item_id} style={row}>
                    <strong>{s.guideline ? t(`guideline.${s.guideline}`) : reasonLabel(null)}</strong>
                    <span style={{ color: colors.muted }}>
                      {' · '}
                      {t(`users.strikes.${s.kind}`)} · {t(`users.strikes.source.${s.source}`)} · {when(s.decided_at)}
                      {s.appeal ? ` · ${t(`users.strikes.appeal.${s.appeal}`)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t('users.moments.title')}>
            {moments.length === 0 ? (
              <Empty>{t('users.moments.empty')}</Empty>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 12,
                }}
              >
                {moments.map((m) => {
                  const pair = photos.get(m.id);
                  return (
                    <li key={m.id} style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                      <BlurredPhoto
                        url={pair?.full ?? pair?.thumb ?? null}
                        label={t('detail.photo', { slot: m.slot })}
                        aspect="3 / 4"
                      />
                      <span style={{ fontWeight: 700 }}>
                        #{m.slot} · {dayLabel(m.local_date)}
                      </span>
                      <span style={{ color: colors.muted }}>
                        {t(`users.moments.visibility.${m.visibility}`)} · {t(`users.moments.status.${m.status}`)}
                        {m.hidden ? ` · ${t('users.moments.hidden')}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {usage ? (
            <Card title={t('users.usage.title')}>
              <p style={{ margin: 0, fontSize: 14 }}>
                {t('users.usage.line', {
                  moments: usage.moments,
                  days: usage.active_days,
                  total: usage.moments_all_time,
                })}
                {usage.last_added_at ? (
                  <span style={{ color: colors.muted }}>
                    {' · '}
                    {t('users.usage.last', { date: when(usage.last_added_at) })}
                  </span>
                ) : null}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <DayBars
                  title={t('users.usage.perDay')}
                  days={usage.per_day.map((d) => ({ day: d.day, count: d.moments }))}
                />
                <BarList
                  title={t('users.usage.slots')}
                  rows={usage.per_slot.map((r) => ({ label: `#${r.slot}`, value: r.moments }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <div>
                  <h3 style={{ margin: '4px 0', fontSize: 13, color: colors.muted }}>{t('users.usage.stickers')}</h3>
                  {usage.stickers.length === 0 ? (
                    <Empty>{t('users.usage.noStickers')}</Empty>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {usage.stickers.map((s) => (
                        <li key={`${s.pack}/${s.label}`} style={row}>
                          <strong>{s.label}</strong>
                          <span style={{ color: colors.muted }}>
                            {' · '}
                            {s.pack} · {t('users.usage.uses', { count: s.uses })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 style={{ margin: '4px 0', fontSize: 13, color: colors.muted }}>{t('users.usage.packs')}</h3>
                  {usage.packs.length === 0 ? (
                    <Empty>{t('users.usage.noPacks')}</Empty>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {usage.packs.map((pk) => (
                        <li key={pk.slug} style={row}>
                          <strong>{pk.name}</strong>
                          <span style={{ color: colors.muted }}>
                            {' · '}
                            {t(`users.usage.source.${pk.source}`)} · {when(pk.acquired_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>{t('users.usage.note')}</p>
            </Card>
          ) : null}

          <Card title={t('users.reports.title')}>
            {user.reports_against.length === 0 ? (
              <Empty>{t('users.reports.empty')}</Empty>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {user.reports_against.map((r) => (
                  <li key={r.id} style={row}>
                    <strong>{reasonLabel(r.reason)}</strong>
                    <span style={{ color: colors.muted }}>
                      {' · '}
                      {t('users.reports.line', {
                        target: r.target,
                        reporter: r.reporter ?? t('queue.noUser'),
                        date: when(r.created_at),
                      })}
                    </span>
                    {r.note ? <span style={{ display: 'block', color: colors.inkSoft }}>“{r.note}”</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t('users.history.title')}
            action={
              <Link
                href={`/audit?user=${profile.id}`}
                style={{ color: colors.brandLink, fontWeight: 700, fontSize: 14 }}
              >
                {t('users.history.audit')}
              </Link>
            }
          >
            {user.history.length === 0 ? (
              <Empty>{t('users.history.empty')}</Empty>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {user.history.map((h) => (
                  <li key={h.id} style={row}>
                    <strong>{actionLabel(h.action)}</strong>
                    <span style={{ color: colors.muted }}>
                      {' · '}
                      {h.actor ? `@${h.actor}` : t('audit.system')} · {when(h.created_at)}
                      {h.target && h.target !== 'profile' ? ` · ${h.target}` : ''}
                    </span>
                    {details(h) ? <span style={{ display: 'block', color: colors.muted }}>{details(h)}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={t('users.suspension.title')}>
          {suspension ? (
            <dl style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '6px 12px', margin: 0, fontSize: 13 }}>
              <dt style={{ color: colors.muted }}>{t('users.suspension.kind')}</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{t(`users.suspension.kinds.${suspension.kind}`)}</dd>
              <dt style={{ color: colors.muted }}>{t('users.suspension.until')}</dt>
              <dd style={{ margin: 0 }}>{suspension.until ? when(suspension.until) : t('users.suspension.noEnd')}</dd>
              {suspension.by ? (
                <>
                  <dt style={{ color: colors.muted }}>{t('users.suspension.by')}</dt>
                  <dd style={{ margin: 0 }}>@{suspension.by}</dd>
                </>
              ) : null}
              {suspension.note ? (
                <>
                  <dt style={{ color: colors.muted }}>{t('users.suspension.note')}</dt>
                  <dd style={{ margin: 0 }}>{suspension.note}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <Empty>{t('users.suspension.none')}</Empty>
          )}
          {user.can_suspend ? (
            <>
              <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 13 }}>{t('users.suspend.hint')}</p>
              <SuspendForm user={profile.id} lift={false} />
            </>
          ) : null}
          {user.can_lift ? (
            <>
              <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 13 }}>{t('users.lift.hint')}</p>
              <SuspendForm user={profile.id} lift />
            </>
          ) : null}
          {suspension?.kind === 'child_safety' ? <Empty>{t('users.suspension.childSafetyHint')}</Empty> : null}
        </Card>
      </div>
    </div>
  );
}
