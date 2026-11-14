import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { t } from '~/i18n/t';

export const PAGE = 50;

const Entry = z.object({
  id: z.number(),
  actor_id: z.uuid().nullable(),
  action: z.string(),
  target: z.string().nullable(),
  target_id: z.uuid().nullable(),
  data: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
export type AuditEntry = z.infer<typeof Entry> & { actor: string | null };

/**
 * One page of the audit log, newest first (RLS: moderators read it; nobody can change it, 0001 and 0041).
 * `before` is the id to page back from; `user` keeps rows that person did or that were about their account.
 */
export async function loadAudit(
  client: SupabaseClient,
  before: number | null,
  user: string | null = null,
): Promise<AuditEntry[]> {
  let query = client
    .from('audit_log')
    .select('id, actor_id, action, target, target_id, data, created_at')
    .order('id', { ascending: false })
    .limit(PAGE);
  if (before !== null) query = query.lt('id', before);
  if (user !== null) query = query.or(`actor_id.eq.${user},target_id.eq.${user}`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = z.array(Entry).parse(data);
  const ids = [...new Set(rows.flatMap((r) => (r.actor_id ? [r.actor_id] : [])))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people } = await client.from('public_profiles').select('id, username').in('id', ids);
    for (const p of z
      .array(z.object({ id: z.uuid(), username: z.string() }))
      .catch([])
      .parse(people)) {
      names.set(p.id, p.username);
    }
  }
  return rows.map((r) => ({ ...r, actor: r.actor_id ? (names.get(r.actor_id) ?? r.actor_id.slice(0, 8)) : null }));
}

export function actionLabel(action: string): string {
  try {
    return t(`audit.actions.${action}`);
  } catch {
    return action;
  }
}

export function details(e: Pick<AuditEntry, 'data'>): string {
  const parts: string[] = [];
  const { result, guideline, note, reason, strikes } = e.data;
  // The Action column already says kept or removed; only an appeal's outcome adds something.
  if (result === 'overturned' || result === 'upheld') parts.push(t(`audit.outcome.${result}`));
  if (reason === 'expired' || reason === 'appeal_overturned' || reason === 'moderator') {
    parts.push(t(`audit.lifted.${reason}`));
  }
  if (typeof e.data.until === 'string') parts.push(t('audit.until', { date: when(e.data.until) }));
  if (typeof strikes === 'number') parts.push(t('audit.strikes', { count: strikes }));
  if (typeof guideline === 'string') parts.push(t('audit.guideline', { guideline: t(`guideline.${guideline}`) }));
  if (typeof note === 'string') parts.push(t('audit.note', { note }));
  return parts.join(' · ');
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}
