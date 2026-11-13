// Pure logic for the Notifications screen (M3-19; FR-NOT-03): the row schema, likes on the same jar or
// moment folded into one entry, the Today / This week / Earlier groups, and where a tap goes.
import { z } from 'zod';

import { addDays } from '@/lib/jars';

export const notificationType = z.enum([
  'new_reader',
  'like',
  'comment',
  'reply',
  'full_jar',
  'removed',
  'appeal_decided',
  'friend_joined',
]);
export type NotificationType = z.infer<typeof notificationType>;

const actor = z.object({ id: z.string(), username: z.string(), display_name: z.string() });

export const notificationRow = z.object({
  id: z.string(),
  type: notificationType,
  read_at: z.string().nullable(),
  created_at: z.string(),
  jar_id: z.string().nullable(),
  moment_id: z.string().nullable(),
  comment_id: z.string().nullable(),
  // Null when the actor deleted their account or RLS hides them (blocked either way, not active).
  actor: actor.nullable(),
  jar: z.object({ local_date: z.string() }).nullable(),
  comment: z.object({ body: z.string(), jar_id: z.string() }).nullable(),
});
export type NotificationRow = z.infer<typeof notificationRow>;
export type NotificationActor = z.infer<typeof actor>;

/** One line on the screen: a notification, or several likes on the same jar or moment. */
export type NotificationEntry = {
  key: string;
  type: NotificationType;
  /** Newest first. */
  ids: string[];
  createdAt: string;
  /** Distinct actors, newest first. */
  actors: NotificationActor[];
  jarId: string | null;
  momentId: string | null;
  commentId: string | null;
  jarDate: string | null;
  commentBody: string | null;
  unread: boolean;
};

export type NotificationSection = { key: 'today' | 'week' | 'earlier'; entries: NotificationEntry[] };

/** Social rows need their actor; when RLS hides the actor (a block since) the row isn't shown. */
const NEEDS_ACTOR: ReadonlySet<NotificationType> = new Set(['new_reader', 'like', 'comment', 'reply', 'friend_joined']);

function toEntry(row: NotificationRow): NotificationEntry {
  return {
    key: row.id,
    type: row.type,
    ids: [row.id],
    createdAt: row.created_at,
    actors: row.actor ? [row.actor] : [],
    jarId: row.jar_id ?? row.comment?.jar_id ?? null,
    momentId: row.moment_id,
    commentId: row.comment_id,
    jarDate: row.jar?.local_date ?? null,
    commentBody: row.comment?.body ?? null,
    unread: row.read_at === null,
  };
}

/** Local calendar date (YYYY-MM-DD) of an instant in `tz`. */
export function localDateOf(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    instant,
  );
}

function sectionOf(createdAt: string, today: string, tz: string): NotificationSection['key'] {
  const day = localDateOf(new Date(createdAt), tz);
  if (day === today) return 'today';
  return day > addDays(today, -7) ? 'week' : 'earlier';
}

/**
 * Rows (newest first) into the screen's groups. Likes on the same jar or moment within a group fold into
 * one entry ("Aya and 12 others liked …"), placed where the newest of them is.
 */
export function buildSections(rows: NotificationRow[], now: Date, tz: string): NotificationSection[] {
  const today = localDateOf(now, tz);
  const sections: NotificationSection[] = [
    { key: 'today', entries: [] },
    { key: 'week', entries: [] },
    { key: 'earlier', entries: [] },
  ];
  const likes = new Map<string, NotificationEntry>();
  for (const row of rows) {
    if (NEEDS_ACTOR.has(row.type) && row.actor === null) continue;
    const section = sections.find((s) => s.key === sectionOf(row.created_at, today, tz))!;
    if (row.type === 'like') {
      const likeKey = `${section.key}:like:${row.jar_id ?? ''}:${row.moment_id ?? ''}`;
      const entry = likes.get(likeKey);
      if (entry) {
        entry.ids.push(row.id);
        if (row.actor && !entry.actors.some((a) => a.id === row.actor?.id)) entry.actors.push(row.actor);
        entry.unread ||= row.read_at === null;
        continue;
      }
      const created = { ...toEntry(row), key: likeKey };
      likes.set(likeKey, created);
      section.entries.push(created);
      continue;
    }
    section.entries.push(toEntry(row));
  }
  return sections.filter((s) => s.entries.length > 0);
}

/** Where tapping an entry goes; null when there is nothing to open. */
export type NotificationTarget =
  | { pathname: '/u/[username]'; params: { username: string } }
  | { pathname: '/jar/[id]'; params: { id: string } }
  | { pathname: '/moment/[id]'; params: { id: string } }
  | { pathname: '/comments/[jarId]'; params: { jarId: string; momentId?: string } };

export function targetOf(entry: NotificationEntry): NotificationTarget | null {
  switch (entry.type) {
    case 'new_reader':
    case 'friend_joined': {
      const who = entry.actors[0];
      return who ? { pathname: '/u/[username]', params: { username: who.username } } : null;
    }
    case 'comment':
    case 'reply':
      // A comment or reply in a moment's own thread opens that thread (0068, D-51).
      if (!entry.jarId) return null;
      return entry.momentId
        ? { pathname: '/comments/[jarId]', params: { jarId: entry.jarId, momentId: entry.momentId } }
        : { pathname: '/comments/[jarId]', params: { jarId: entry.jarId } };
    case 'like':
    case 'removed':
    case 'appeal_decided':
      if (entry.momentId) return { pathname: '/moment/[id]', params: { id: entry.momentId } };
      return entry.jarId ? { pathname: '/jar/[id]', params: { id: entry.jarId } } : null;
    case 'full_jar':
      return entry.jarId ? { pathname: '/jar/[id]', params: { id: entry.jarId } } : null;
  }
}

/** What fn:send-push puts in a push's data (supabase/functions/send-push/messages.ts). Reminders have none of it. */
const pushData = z.object({
  type: notificationType,
  jarId: z.string().optional(),
  momentId: z.string().optional(),
  commentId: z.string().optional(),
});

/**
 * Where tapping a server push goes: the same screen as its Notifications row (a comment on a moment opens
 * that moment's thread, 0068), else the Notifications screen. Null for anything that isn't a server push
 * (a slot reminder opens the app where it is).
 */
export function pushTarget(data: unknown): NotificationTarget | { pathname: '/notifications' } | null {
  const parsed = pushData.safeParse(data);
  if (!parsed.success) return null;
  const { type, jarId, momentId, commentId } = parsed.data;
  const entry: NotificationEntry = {
    key: '',
    type,
    ids: [],
    createdAt: '',
    actors: [],
    jarId: jarId ?? null,
    momentId: momentId ?? null,
    commentId: commentId ?? null,
    jarDate: null,
    commentBody: null,
    unread: false,
  };
  return targetOf(entry) ?? { pathname: '/notifications' };
}

/** Short age beside an entry: "now", "12m", "1h" today; the weekday this week; a date before that. */
export function ageLabel(
  createdAt: string,
  now: Date,
  tz: string,
  locale: string,
): { kind: 'now' | 'minutes' | 'hours'; count: number } | { kind: 'date'; text: string } {
  const at = new Date(createdAt);
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (localDateOf(at, tz) === localDateOf(now, tz)) {
    if (minutes < 1) return { kind: 'now', count: 0 };
    if (minutes < 60) return { kind: 'minutes', count: minutes };
    return { kind: 'hours', count: Math.floor(minutes / 60) };
  }
  const options: Intl.DateTimeFormatOptions =
    sectionOf(createdAt, localDateOf(now, tz), tz) === 'week'
      ? { weekday: 'short', timeZone: tz }
      : { month: 'short', day: 'numeric', timeZone: tz };
  return { kind: 'date', text: new Intl.DateTimeFormat(locale, options).format(at) };
}
