import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { type AuditEntry, loadAudit, PAGE } from '~/lib/audit';
import { supabase } from '~/lib/supabase';

const grid = { display: 'grid', gridTemplateColumns: '150px 150px 170px 160px 1fr', gap: 12, alignItems: 'start' };

function actionLabel(action: string): string {
  try {
    return t(`audit.actions.${action}`);
  } catch {
    return action;
  }
}

function details(e: AuditEntry): string {
  const parts: string[] = [];
  const { result, guideline, note, reason, strikes } = e.data;
  // The Action column already says kept or removed; only an appeal's outcome adds something.
  if (result === 'overturned' || result === 'upheld') parts.push(t(`audit.outcome.${result}`));
  if (reason === 'expired' || reason === 'appeal_overturned') parts.push(t(`audit.lifted.${reason}`));
  if (typeof strikes === 'number') parts.push(t('audit.strikes', { count: strikes }));
  if (typeof guideline === 'string') parts.push(t('audit.guideline', { guideline: t(`guideline.${guideline}`) }));
  if (typeof note === 'string') parts.push(t('audit.note', { note }));
  return parts.join(' · ');
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

// The audit log (FR-MOD-05): who decided what, newest first. Read-only by design: there are no controls,
// and Postgres refuses any change to it (revoked rights and an append-only trigger).
export default async function Audit({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before } = await searchParams;
  const cursor = before && /^\d+$/.test(before) ? Number(before) : null;
  const entries = await loadAudit(await supabase(), cursor);
  const last = entries.at(-1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('audit.title')}</h1>
        <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('audit.subtitle')}</p>
      </header>
      <section
        aria-label={t('audit.label')}
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
          <span>{t('audit.columns.when')}</span>
          <span>{t('audit.columns.who')}</span>
          <span>{t('audit.columns.action')}</span>
          <span>{t('audit.columns.target')}</span>
          <span>{t('audit.columns.details')}</span>
        </div>
        {entries.length === 0 ? (
          <p style={{ padding: 24, margin: 0, color: colors.muted }}>{t('audit.empty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{ ...grid, padding: '10px 14px', fontSize: 14, borderBottom: `1px solid ${colors.divider}` }}
              >
                <span style={{ color: colors.muted }}>{when(e.created_at)}</span>
                <span>{e.actor ? `@${e.actor}` : t('audit.system')}</span>
                <span style={{ fontWeight: 700 }}>{actionLabel(e.action)}</span>
                <span style={{ color: colors.muted }}>
                  {e.target ? `${e.target} ${e.target_id?.slice(0, 8) ?? ''}` : '—'}
                </span>
                <span style={{ color: colors.muted, overflowWrap: 'anywhere' }}>{details(e)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
        {cursor !== null ? (
          <Link href="/audit" style={{ color: colors.ink, fontWeight: 700 }}>
            {t('audit.newest')}
          </Link>
        ) : null}
        {entries.length === PAGE && last ? (
          <Link href={`/audit?before=${last.id}`} style={{ color: colors.ink, fontWeight: 700 }}>
            {t('audit.older')}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
