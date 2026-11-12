// Data for the Notifications screen and the bell's unread dot (M3-19; FR-NOT-03). Rows come straight from
// `notifications` under RLS (notifications_owner: only your own); the actor, jar and comment are embedded,
// and RLS on those tables drops anyone blocked either way since. Avatars and photo thumbnails come from
// fn:photo-urls (thumbnails only). Opening the screen marks everything read on the server.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { notificationRow, type NotificationRow } from './notificationsModel';

const LIMIT = 100;
const PHOTO_BATCH = 100; // fn:photo-urls MAX_BATCH, per list
const SELECT =
  'id, type, read_at, created_at, jar_id, moment_id, comment_id, ' +
  'actor:profiles!notifications_actor_id_fkey(id, username, display_name), ' +
  'jar:jars!notifications_jar_id_fkey(local_date), ' +
  'comment:comments!notifications_comment_id_fkey(body, jar_id)';

const photoUrlsResponse = z.object({
  data: z.object({
    moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })),
    profiles: z.array(z.object({ id: z.string(), avatar: z.string().nullable() })),
  }),
});

export type NotificationsData = {
  rows: NotificationRow[];
  /** Signed avatar URL by profile id. */
  avatars: Record<string, string | null>;
  /** Signed thumbnail URL by moment id. */
  thumbs: Record<string, string | null>;
  /** A jar's first live moment, for the thumbnail beside likes and comments on the whole jar. */
  jarMoment: Record<string, string>;
  /** Actors the viewer already reads: no Read / Read back button for them. */
  reading: string[];
};

async function photoUrls(momentIds: string[], profileIds: string[]) {
  const body = { momentIds: momentIds.slice(0, PHOTO_BATCH), profileIds: profileIds.slice(0, PHOTO_BATCH) };
  if (body.momentIds.length + body.profileIds.length === 0) return { moments: [], profiles: [] };
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body });
  const parsed = photoUrlsResponse.safeParse(data);
  // A failure leaves avatars on their initials and thumbnails on their placeholder.
  return error || !parsed.success ? { moments: [], profiles: [] } : parsed.data.data;
}

export async function fetchNotifications(viewerId: string): Promise<NotificationsData> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) throw new Error(error.message);
  const rows = z.array(notificationRow).parse(data);

  const actorIds = [...new Set(rows.flatMap((r) => (r.actor ? [r.actor.id] : [])))];
  const photoTypes = new Set(['like', 'comment', 'reply']);
  const withPhoto = rows.filter((r) => photoTypes.has(r.type));
  const jarIds = [
    ...new Set(
      withPhoto.flatMap((r) =>
        r.moment_id === null && (r.jar_id ?? r.comment?.jar_id) ? [r.jar_id ?? r.comment!.jar_id] : [],
      ),
    ),
  ];

  const [moments, follows] = await Promise.all([
    jarIds.length === 0
      ? Promise.resolve([] as { id: string; jar_id: string }[])
      : supabase
          .from('moments')
          .select('id, jar_id')
          .in('jar_id', jarIds)
          .eq('status', 'live')
          .order('added_at', { ascending: true })
          .then(({ data: m, error: e }) => {
            if (e) throw new Error(e.message);
            return z.array(z.object({ id: z.string(), jar_id: z.string() })).parse(m);
          }),
    actorIds.length === 0
      ? Promise.resolve([] as { author_id: string }[])
      : supabase
          .from('follows')
          .select('author_id')
          .eq('reader_id', viewerId)
          .in('author_id', actorIds)
          .then(({ data: f, error: e }) => {
            if (e) throw new Error(e.message);
            return z.array(z.object({ author_id: z.string() })).parse(f);
          }),
  ]);

  const jarMoment: Record<string, string> = {};
  for (const m of moments) jarMoment[m.jar_id] ??= m.id;
  const momentIds = [
    ...new Set([...withPhoto.flatMap((r) => (r.moment_id ? [r.moment_id] : [])), ...Object.values(jarMoment)]),
  ];
  const urls = await photoUrls(momentIds, actorIds);
  return {
    rows,
    avatars: Object.fromEntries(urls.profiles.map((p) => [p.id, p.avatar])),
    thumbs: Object.fromEntries(urls.moments.map((m) => [m.id, m.thumb])),
    jarMoment,
    reading: follows.map((f) => f.author_id),
  };
}

export const notificationQueryKeys = {
  /** ['notifications', userId] */
  list: (userId: string) => ['notifications', userId] as const,
  /** ['notifications', userId, 'unread'] */
  unread: (userId: string) => ['notifications', userId, 'unread'] as const,
};

export function useNotifications() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationQueryKeys.list(userId ?? ''),
    queryFn: () => fetchNotifications(userId ?? ''),
    enabled: userId !== null,
  });
  const markRead = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase()
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      if (userId !== null) queryClient.setQueryData(notificationQueryKeys.unread(userId), 0);
    },
  });
  return {
    userId,
    data: query.data,
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
    markAllRead: () => markRead.mutate(),
  };
}

/** Unread rows, for the dot on the Jars tab's bell. The tab stays mounted, so it calls `refresh` on focus. */
export function useUnreadNotifications() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const query = useQuery({
    queryKey: notificationQueryKeys.unread(userId ?? ''),
    queryFn: async () => {
      const { count, error } = await getSupabase()
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    enabled: userId !== null,
    staleTime: 0,
  });
  return {
    hasUnread: (query.data ?? 0) > 0,
    refresh: () => void query.refetch(),
  };
}
