import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// public.mod_user_search_page() (0120), mod_user() and mod_user_moments() (0090). Text and ids only; photos come from
// fn:photo-urls, which signs only what the moderator may see (public or queued moments).
const Status = z.enum(['active', 'suspended', 'deleted', 'waiting']);

const Row = z.object({
  id: z.uuid(),
  username: z.string(),
  display_name: z.string(),
  status: Status,
  suspended_until: z.string().nullable(),
  created_at: z.string(),
  strikes: z.number(),
  moment_count: z.number(),
  open_reports: z.number(),
});
export type UserRow = z.infer<typeof Row>;

const AuditItem = z.object({
  id: z.number(),
  created_at: z.string(),
  action: z.string(),
  target: z.string().nullable(),
  target_id: z.uuid().nullable(),
  data: z.record(z.string(), z.unknown()),
  actor: z.string().nullable(),
});
export type UserAuditItem = z.infer<typeof AuditItem>;

const Detail = z.object({
  profile: z.object({
    id: z.uuid(),
    username: z.string(),
    display_name: z.string(),
    bio: z.string().nullable(),
    status: Status,
    suspended_until: z.string().nullable(),
    created_at: z.string(),
    home_tz: z.string().nullable(),
    reader_count: z.number(),
    author_count: z.number(),
    jar_count: z.number(),
    email: z.string().nullable(),
  }),
  suspension: z
    .object({
      kind: z.enum(['manual', 'strikes', 'child_safety']),
      until: z.string().nullable(),
      note: z.string().nullable(),
      by: z.string().nullable(),
    })
    .nullable(),
  moments: z.object({ total: z.number(), live: z.number(), checking: z.number(), removed: z.number() }),
  strikes: z.object({
    count: z.number(),
    items: z.array(
      z.object({
        item_id: z.uuid(),
        kind: z.enum(['moment', 'comment']),
        target_id: z.uuid(),
        source: z.string(),
        guideline: z.string().nullable(),
        decided_at: z.string(),
        appeal: z.string().nullable(),
      }),
    ),
  }),
  reports_against: z.array(
    z.object({
      id: z.uuid(),
      created_at: z.string(),
      reason: z.string(),
      target: z.string(),
      target_id: z.uuid(),
      note: z.string().nullable(),
      status: z.string(),
      reporter: z.string().nullable(),
    }),
  ),
  reports_filed: z.object({ total: z.number(), week: z.number() }),
  history: z.array(AuditItem),
  can_suspend: z.boolean(),
  can_lift: z.boolean(),
});
export type UserDetail = z.infer<typeof Detail>;

const Moment = z.object({
  id: z.uuid(),
  local_date: z.string(),
  slot: z.string(),
  status: z.enum(['uploading', 'checking', 'live', 'removed']),
  visibility: z.enum(['readers', 'everyone', 'only_me']),
  caption: z.string().nullable(),
  added_at: z.string(),
  hidden: z.boolean(),
  moderation: z.string().nullable(),
});
export type UserMoment = z.infer<typeof Moment>;

export const USER_SORTS = ['newest', 'oldest', 'username', 'strikes', 'reports'] as const;
export type UserSort = (typeof USER_SORTS)[number];

/** One page of matching accounts (0120) and how many match in all. An exact username comes first. */
export async function searchUsers(
  client: SupabaseClient,
  query: string,
  sort: UserSort,
  page: { size: number; offset: number },
): Promise<{ rows: UserRow[]; total: number }> {
  const { data, error } = await client.rpc('mod_user_search_page', {
    p_query: query.slice(0, 254),
    p_sort: sort,
    p_limit: page.size,
    p_offset: page.offset,
  });
  if (error) throw new Error(error.message);
  const rows = z.array(Row.extend({ total: z.number() })).parse(data);
  return { rows, total: rows[0]?.total ?? 0 };
}

export async function loadUser(client: SupabaseClient, id: string): Promise<UserDetail | null> {
  const { data, error } = await client.rpc('mod_user', { p_user: id });
  if (error) throw new Error(error.message);
  return Detail.nullable().parse(data);
}

export async function loadUserMoments(client: SupabaseClient, id: string): Promise<UserMoment[]> {
  const { data, error } = await client.rpc('mod_user_moments', { p_user: id, p_limit: 60 });
  if (error) throw new Error(error.message);
  return z.array(Moment).parse(data);
}

export const SUSPEND_RESULTS = [
  'suspended',
  'lifted',
  'not_found',
  'own_account',
  'not_active',
  'not_suspended',
  'child_safety',
] as const;
export type SuspendResult = (typeof SUSPEND_RESULTS)[number] | 'note' | 'unknown';
