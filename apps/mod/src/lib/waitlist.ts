import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// public.mod_waitlist_summary(), mod_waitlist(), mod_waitlist_export() and mod_waitlist_remove() (0091).
// The waitlist table has no client grants; these functions are the only way in, and they refuse non-moderators.
export const STATES = ['all', 'email_only', 'waiting', 'admitted', 'member'] as const;
export type WaitlistState = (typeof STATES)[number];
export const PAGE = 50;

const Summary = z.object({
  total: z.number(),
  email_only: z.number(),
  waiting: z.number(),
  admitted: z.number(),
  members: z.number(),
  today: z.number(),
  last_7_days: z.number(),
  per_day: z.array(z.object({ day: z.string(), count: z.number() })),
  sources: z.array(z.object({ source: z.string(), count: z.number() })),
});
export type WaitlistSummary = z.infer<typeof Summary>;

const Row = z.object({
  email: z.string(),
  source: z.string(),
  created_at: z.string(),
  state: z.enum(STATES).exclude(['all']),
});
export type WaitlistRow = z.infer<typeof Row>;

export async function loadSummary(client: SupabaseClient): Promise<WaitlistSummary> {
  const { data, error } = await client.rpc('mod_waitlist_summary');
  if (error) throw new Error(error.message);
  return Summary.parse(data);
}

export async function loadWaitlist(
  client: SupabaseClient,
  query: string,
  state: WaitlistState,
  page: number,
): Promise<{ rows: WaitlistRow[]; total: number }> {
  const { data, error } = await client.rpc('mod_waitlist', {
    p_query: query,
    p_state: state,
    p_limit: PAGE,
    p_offset: page * PAGE,
  });
  if (error) throw new Error(error.message);
  const rows = z.array(Row.extend({ total: z.number() })).parse(data);
  return { rows, total: rows[0]?.total ?? 0 };
}

/** The whole list, oldest first, for the CSV download. Postgres writes the export to the audit log. */
export async function exportWaitlist(client: SupabaseClient): Promise<WaitlistRow[]> {
  const { data, error } = await client.rpc('mod_waitlist_export');
  if (error) throw new Error(error.message);
  return z.array(Row).parse(data);
}

// A spreadsheet runs a cell that starts with = + - @ as a formula; a leading quote keeps it as text.
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: WaitlistRow[]): string {
  const lines = [['email', 'source', 'joined_at', 'state'].join(',')];
  for (const r of rows) lines.push([r.email, r.source, r.created_at, r.state].map(cell).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export const REMOVE_RESULTS = ['removed', 'not_found', 'note', 'unknown'] as const;
export type RemoveResult = (typeof REMOVE_RESULTS)[number];
