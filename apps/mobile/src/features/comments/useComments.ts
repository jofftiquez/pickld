// Data for /comments/[jarId] (M3-11; FR-SOC-06): the jar's comments read as the viewer (RLS decides),
// adding a comment or reply, and deleting one. A new comment is inserted hidden, then fn:moderate's text
// path shows it (M3-10; D-22 auto-pass); until then only its author sees it. If that call is lost, the
// comment stays with its author as "Checking" and the next send or refresh asks again.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { jarPageQueryKeys } from '@/features/jar/useJarPage';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { commentRow, type CommentRow } from './commentsModel';

const jarIdParam = z.uuid();

export async function fetchComments(jarId: string): Promise<CommentRow[]> {
  const { data, error } = await getSupabase()
    .from('comments')
    .select('id, jar_id, user_id, parent_id, body, is_hidden, created_at, author:profiles(display_name, username)')
    .eq('jar_id', jarId)
    .order('created_at', { ascending: true });
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
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('comments')
    .insert({ jar_id: jarId, user_id: userId, body, parent_id: parentId })
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
  /** ['comments', viewerId, jarId] */
  jar: (viewerId: string, jarId: string) => ['comments', viewerId, jarId] as const,
};

export function useComments(jarId: string | undefined) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const valid = jarIdParam.safeParse(jarId).success;
  const queryClient = useQueryClient();
  const key = commentsQueryKeys.jar(viewerId ?? '', jarId ?? '');
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchComments(jarId ?? ''),
    enabled: viewerId !== null && valid,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    // The jar's comment_count (Jar page, Moment detail, feed) follows the visible comments.
    void queryClient.invalidateQueries({ queryKey: jarPageQueryKeys.jar(viewerId ?? '', jarId ?? '') });
    void queryClient.invalidateQueries({ queryKey: ['feed', viewerId ?? ''] });
  };

  const add = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId: string | null }) =>
      postComment(jarId ?? '', viewerId ?? '', body, parentId),
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
