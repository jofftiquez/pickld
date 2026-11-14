// Like and unlike a jar or one of its moments (M3-09; FR-SOC-05). The count and the heart change at once
// in the cached jar page (optimistic); the database keeps one like per user per target (the reactions
// primary key) and RLS allows likes only on targets the viewer can see (0005, pgTAP 006_social).
// Requests for one target run one after another, so fast taps reach the server in the order they were
// made and the last tap wins. A failed request undoes its own change; when a target has no requests left
// in flight the page and the feed are read again so counts match the server.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

import { isLiked, withLike, type JarPageData, type LikeTarget } from './jarPage';
import { jarPageQueryKeys } from './useJarPage';

type Vars = { target: LikeTarget; liked: boolean };

const chains = new Map<string, Promise<unknown>>();
const inFlight = new Map<string, number>();

export const keyOf = (jarId: string, target: LikeTarget) =>
  target.kind === 'jar' ? `jar:${jarId}` : `moment:${target.id}`;

/** Runs `run` after every earlier request for the same key has settled. Shared with the Moments timeline's likes. */
export function serialize<T>(key: string, run: () => Promise<T>): Promise<T> {
  const next = (chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(run);
  chains.set(key, next);
  return next;
}

export async function sendLike(userId: string, jarId: string, { target, liked }: Vars): Promise<void> {
  const row = { user_id: userId, target: target.kind, target_id: target.kind === 'jar' ? jarId : target.id };
  const supabase = getSupabase();
  const { error } = liked
    ? // Already liked (another device, a retried request) is fine: nothing to change.
      await supabase.from('reactions').upsert(row, { onConflict: 'user_id,target,target_id', ignoreDuplicates: true })
    : await supabase
        .from('reactions')
        .delete()
        .eq('user_id', row.user_id)
        .eq('target', row.target)
        .eq('target_id', row.target_id);
  if (error) throw new Error(error.message);
}

/** `toggle(target)` flips the viewer's like on the jar page `jarId`. */
export function useLike(viewerId: string | null, jarId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = jarPageQueryKeys.jar(viewerId ?? '', jarId ?? '');
  const mutation = useMutation({
    mutationFn: (vars: Vars) =>
      serialize(keyOf(jarId ?? '', vars.target), () => sendLike(viewerId ?? '', jarId ?? '', vars)),
    onMutate: (vars) => {
      const key = keyOf(jarId ?? '', vars.target);
      inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
      queryClient.setQueryData<JarPageData | null>(queryKey, (data) =>
        data ? withLike(data, vars.target, vars.liked) : data,
      );
    },
    onError: (_error, vars) => {
      queryClient.setQueryData<JarPageData | null>(queryKey, (data) =>
        data ? withLike(data, vars.target, !vars.liked) : data,
      );
    },
    onSettled: (_data, _error, vars) => {
      const key = keyOf(jarId ?? '', vars.target);
      const left = (inFlight.get(key) ?? 1) - 1;
      if (left > 0) {
        inFlight.set(key, left);
        return;
      }
      inFlight.delete(key);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['feed', viewerId ?? ''] });
      if (vars.target.kind === 'moment') {
        void queryClient.invalidateQueries({ queryKey: ['momentsFeed', viewerId ?? ''] });
        void queryClient.invalidateQueries({ queryKey: ['discover', 'moments'] });
      }
    },
  });

  return {
    toggle: (target: LikeTarget) => {
      if (viewerId === null || jarId === null) return;
      const data = queryClient.getQueryData<JarPageData | null>(queryKey);
      if (!data) return;
      mutation.mutate({ target, liked: !isLiked(data, target) });
    },
  };
}
