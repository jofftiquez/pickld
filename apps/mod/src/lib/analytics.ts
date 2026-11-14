import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { t } from '~/i18n/t';

// public.mod_analytics(), mod_analytics_stickers() and mod_user_stats() (0101), mod_sticker_thumbs() (0110). Counts only, by Manila day;
// Only me and removed moments are never counted (rule 9). The functions refuse non-moderators.
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: string | undefined): Range {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

const SlotCount = z.object({ slot: z.string(), moments: z.number() });
// A group of fewer than five people comes back as { hidden: true } with no numbers.
const Group = z.object({
  hidden: z.literal(true).optional(),
  people: z.number().optional(),
  posters: z.number().optional(),
  moments: z.number().optional(),
});

const Analytics = z.object({
  days: z.number(),
  totals: z.object({
    people: z.number(),
    moments_all_time: z.number(),
    moments: z.number(),
    posters: z.number(),
    signups: z.number(),
    with_stickers: z.number(),
  }),
  per_day: z.array(z.object({ day: z.string(), moments: z.number(), posters: z.number(), signups: z.number() })),
  per_slot: z.array(SlotCount),
  age_bands: z.array(Group.extend({ band: z.string() })),
  zones: z.array(Group.extend({ zone: z.string() })),
});
export type SiteAnalytics = z.infer<typeof Analytics>;
export type GroupRow = z.infer<typeof Group>;

const Stickers = z.object({
  days: z.number(),
  totals: z.object({ uses: z.number(), uses_before: z.number(), people: z.number(), acquired: z.number() }),
  per_day: z.array(z.object({ day: z.string(), uses: z.number(), acquired: z.number() })),
  packs: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      tier: z.string(),
      status: z.string(),
      stickers: z.number(),
      owners: z.number(),
      acquired: z.number(),
      by_source: z.record(z.string(), z.number()),
      people: z.number(),
      people_all_time: z.number(),
      uses: z.number(),
      uses_before: z.number(),
      uses_total: z.number(),
    }),
  ),
  stickers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      pack: z.string(),
      retired: z.boolean(),
      uses: z.number(),
      uses_before: z.number(),
      people: z.number(),
      uses_total: z.number(),
    }),
  ),
});
export type StickerAnalytics = z.infer<typeof Stickers>;

const UserStats = z.object({
  days: z.number(),
  moments_all_time: z.number(),
  moments: z.number(),
  active_days: z.number(),
  last_added_at: z.string().nullable(),
  per_day: z.array(z.object({ day: z.string(), moments: z.number() })),
  per_slot: z.array(SlotCount),
  stickers: z.array(z.object({ label: z.string(), pack: z.string(), uses: z.number() })),
  packs: z.array(z.object({ slug: z.string(), name: z.string(), source: z.string(), acquired_at: z.string() })),
});
export type UserStats = z.infer<typeof UserStats>;

export async function loadAnalytics(client: SupabaseClient, days: Range): Promise<SiteAnalytics> {
  const { data, error } = await client.rpc('mod_analytics', { p_days: days });
  if (error) throw new Error(error.message);
  return Analytics.parse(data);
}

export async function loadStickerAnalytics(client: SupabaseClient, days: Range): Promise<StickerAnalytics> {
  const { data, error } = await client.rpc('mod_analytics_stickers', { p_days: days });
  if (error) throw new Error(error.message);
  return Stickers.parse(data);
}

const Thumbs = z.object({
  packs: z.array(z.object({ id: z.string(), thumbs: z.number(), thumbs_window: z.number() })),
});
export type PackThumbs = Map<string, { thumbs: number; thumbs_window: number }>;

/** Thumbs up per pack id from active accounts: all time, and in the last `days` Manila days. */
export async function loadPackThumbs(client: SupabaseClient, days: number): Promise<PackThumbs> {
  const { data, error } = await client.rpc('mod_sticker_thumbs', { p_days: days });
  if (error) throw new Error(error.message);
  return new Map(Thumbs.parse(data).packs.map(({ id, ...counts }) => [id, counts]));
}

export async function loadUserStats(client: SupabaseClient, user: string): Promise<UserStats | null> {
  const { data, error } = await client.rpc('mod_user_stats', { p_user: user, p_days: 30 });
  if (error) throw new Error(error.message);
  return data === null ? null : UserStats.parse(data);
}

/** This window against the one before: "new", "same", or a signed percentage such as "+40%". */
export function trend(now: number, before: number): { kind: 'new' | 'same' | 'up' | 'down' | 'none'; pct: number } {
  if (now === 0 && before === 0) return { kind: 'none', pct: 0 };
  if (before === 0) return { kind: 'new', pct: 0 };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { kind: 'same', pct };
  return { kind: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) };
}

/** The trend as the tables and tiles show it. */
export function trendText(now: number, before: number): string {
  const tr = trend(now, before);
  return t(`analytics.trend.${tr.kind}`, { pct: tr.pct });
}
