import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

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
 * `before` is the id to page back from.
 */
export async function loadAudit(client: SupabaseClient, before: number | null): Promise<AuditEntry[]> {
  let query = client
    .from('audit_log')
    .select('id, actor_id, action, target, target_id, data, created_at')
    .order('id', { ascending: false })
    .limit(PAGE);
  if (before !== null) query = query.lt('id', before);
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
