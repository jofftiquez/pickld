import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { monthLabel } from '~/lib/queue';
import { input, secondaryButton } from '~/lib/styles';
import { supabase } from '~/lib/supabase';
import { searchUsers, type UserRow } from '~/lib/users';

const grid = { display: 'grid', gridTemplateColumns: '1fr 140px 100px 90px 90px 110px', gap: 12, alignItems: 'center' };

function statusLabel(u: UserRow): string {
  if (u.status !== 'suspended') return t(`users.status.${u.status}`);
  return u.suspended_until ? t('users.status.suspended') : t('users.status.childSafety');
}

// Users (FR-MOD-07): find an account by username, name, exact email or id. An empty search lists the newest.
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').slice(0, 254);
  const rows = await searchUsers(await supabase(), q);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('users.title')}</h1>
        <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('users.subtitle')}</p>
      </header>
      <form role="search" action="/users" style={{ display: 'flex', gap: 10, maxWidth: 560 }}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={254}
          aria-label={t('users.search.label')}
          placeholder={t('users.search.placeholder')}
          style={{ ...input, flex: 1, minWidth: 0 }}
        />
        <button type="submit" style={{ ...secondaryButton, minHeight: 44 }}>
          {t('users.search.button')}
        </button>
      </form>
      <section
        aria-label={t('users.label')}
        style={{ background: colors.surface, borderRadius: radius.card, overflow: 'hidden' }}
      >
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
          <span>{t('users.columns.user')}</span>
          <span>{t('users.columns.status')}</span>
          <span>{t('users.columns.joined')}</span>
          <span>{t('users.columns.moments')}</span>
          <span>{t('users.columns.strikes')}</span>
          <span>{t('users.columns.reports')}</span>
        </div>
        {rows.length === 0 ? (
          <p style={{ padding: 24, margin: 0, color: colors.muted }}>{t('users.empty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((u) => (
              <li key={u.id} style={{ borderBottom: `1px solid ${colors.divider}` }}>
                <Link
                  href={`/users/${u.id}`}
                  aria-label={t('users.rowLabel', { user: u.username, status: statusLabel(u) })}
                  style={{ ...grid, padding: '10px 14px', textDecoration: 'none', color: colors.ink, fontSize: 14 }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700 }}>@{u.username}</span>
                    <span style={{ color: colors.muted }}> · {u.display_name}</span>
                  </span>
                  <span style={{ color: u.status === 'suspended' ? colors.danger : colors.muted, fontWeight: 600 }}>
                    {statusLabel(u)}
                  </span>
                  <span style={{ color: colors.muted }}>{monthLabel(u.created_at)}</span>
                  <span>{u.moment_count}</span>
                  <span style={{ fontWeight: u.strikes > 0 ? 700 : 400 }}>{u.strikes}</span>
                  <span style={{ fontWeight: u.open_reports > 0 ? 700 : 400 }}>{u.open_reports}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
