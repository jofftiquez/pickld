// Data for /comments/[jarId] (M3-11; FR-SOC-06): one thread read as the viewer (RLS decides), adding a
// comment or reply, and deleting one. The thread is the jar's own, or one moment's (`momentId`, 0068;
// D-51): a moment comment keeps its jar in jar_id. A new comment is inserted hidden, then fn:moderate's
// text path shows it (M3-10; D-22 auto-pass); until then only its author sees it. If that call is lost,
// the comment stays with its author as "Checking" and the next send or refresh asks again.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { jarPageQueryKeys } from '@/features/jar/useJarPage';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { commentRow, type CommentRow } from './commentsModel';

const idParam = z.uuid();

/** The thread's comments: the jar's own (no moment), or one moment's. */
export async function fetchComments(jarId: string, momentId: string | null = null): Promise<CommentRow[]> {
  const query = getSupabase()
    .from('comments')
    .select('id, jar_id, user_id, parent_id, body, is_hidden, created_at, author:profiles(display_name, username)')
    .eq('jar_id', jarId);
  const { data, error } = await (
    momentId === null ? query.is('moment_id', null) : query.eq('moment_id', momentId)
  ).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return z.array(commentRow).parse(data);
}

/**
 * Saves a comment (hidden by the database until checked) and asks fn:moderate to check it. A failed check
 * call leaves it pending for its author instead of failing the send.
 */
export async function postComment(
  jarId: string,
  userId: string,
  body: string,
  parentId: string | null,
  momentId: string | null = null,
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('comments')
    .insert({ jar_id: jarId, moment_id: momentId, user_id: userId, body, parent_id: parentId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await supabase.functions.invoke('moderate', { body: { commentId: data.id } });
  return data.id;
}

/** Soft-deletes a comment; the database allows its author and the jar owner (0005 delete_comment). */
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_comment', { comment_id: commentId });
  if (error) throw new Error(error.message);
}

export const commentsQueryKeys = {
  /** ['comments', viewerId, jarId]: every thread of the jar. */
  jar: (viewerId: string, jarId: string) => ['comments', viewerId, jarId] as const,
  /** ['comments', viewerId, jarId, momentId | null]: one thread (null is the jar's own). */
  thread: (viewerId: string, jarId: string, momentId: string | null) =>
    ['comments', viewerId, jarId, momentId] as const,
};

/** The thread of `jarId`, or of its moment `momentId` when given. */
export function useComments(jarId: string | undefined, momentId?: string) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const moment = momentId ?? null;
  const valid = idParam.safeParse(jarId).success && (moment === null || idParam.safeParse(moment).success);
  const queryClient = useQueryClient();
  const key = commentsQueryKeys.thread(viewerId ?? '', jarId ?? '', moment);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchComments(jarId ?? '', moment),
    enabled: viewerId !== null && valid,
  });
  const refresh = () => {
    // Also the moment header's count (useCommentMoment), whose key starts with the thread's.
    void queryClient.invalidateQueries({ queryKey: key });
    // The jar's and moments' comment_count (Jar page, Moment detail, feed) follow the visible comments.
    void queryClient.invalidateQueries({ queryKey: jarPageQueryKeys.jar(viewerId ?? '', jarId ?? '') });
    void queryClient.invalidateQueries({ queryKey: ['feed', viewerId ?? ''] });
  };

  const add = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId: string | null }) =>
      postComment(jarId ?? '', viewerId ?? '', body, parentId, moment),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: deleteComment,
    onSettled: refresh,
  });

  return {
    viewerId,
    /** Undefined while loading; empty for a malformed id. */
    comments: valid ? query.data : [],
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
    /** Resolves true once the comment is saved (it may still be checking). */
    add: async (body: string, parentId: string | null) => {
      try {
        await add.mutateAsync({ body, parentId });
        return true;
      } catch {
        return false;
      }
    },
    isSending: add.isPending,
    sendFailed: add.isError,
    remove: (commentId: string) => remove.mutate(commentId),
  };
}
