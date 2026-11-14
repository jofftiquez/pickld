// Loads the Invite page (INV-07) and changes the invite link: my_invites, invite_link_set and invite_link_reset
// (0132). Friends' avatars are signed by the page with useAvatarUrls (D-93).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

import { inviteState, myInvitesRow, type Invites } from './invites';

export const inviteQueryKeys = {
  /** ['invites', userId] */
  mine: (userId: string) => ['invites', userId] as const,
};

export async function fetchInvites(): Promise<Invites> {
  const { data, error } = await getSupabase().rpc('my_invites');
  if (error) throw new Error(error.message);
  // Every profile has a holder row (0132); none means the account is gone, which shows as no codes.
  const row = data === null ? null : myInvitesRow.parse(data);
  if (row === null) return { state: 'locked', link: null, codes: [] };
  return {
    state: inviteState(row),
    link: row.link,
    codes: row.codes.map((c) => ({
      code: c.code,
      setNo: c.set_no,
      slot: c.slot,
      used: c.used,
      invitee: c.invitee
        ? {
            joinedAt: c.invitee.joined_at,
            profile: c.invitee.profile
              ? {
                  id: c.invitee.profile.id,
                  username: c.invitee.profile.username,
                  displayName: c.invitee.profile.display_name,
                  avatarPath: c.invitee.profile.avatar_path,
                }
              : null,
          }
        : null,
    })),
  };
}

export function useInvites() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const query = useQuery({
    queryKey: inviteQueryKeys.mine(userId ?? ''),
    queryFn: fetchInvites,
    enabled: userId !== null,
  });
  return {
    invites: query.data,
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
  };
}

/** The link's on/off switch and Reset link. Both read the page again afterwards. */
export function useInviteLink() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = inviteQueryKeys.mine(userId ?? '');
  const refetch = () => queryClient.invalidateQueries({ queryKey: key });
  const setEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await getSupabase().rpc('invite_link_set', { p_enabled: enabled });
      if (error) throw new Error(error.message);
    },
    // The switch moves at once; a failure puts it back when the page reloads.
    onMutate: (enabled) =>
      queryClient.setQueryData<Invites>(key, (old) => (old?.link ? { ...old, link: { ...old.link, enabled } } : old)),
    onSettled: refetch,
  });
  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().rpc('invite_link_reset');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => showToast('linkReset'),
    onSettled: refetch,
  });
  return {
    setEnabled: (enabled: boolean) => setEnabled.mutate(enabled),
    reset: () => reset.mutate(),
    busy: setEnabled.isPending || reset.isPending,
  };
}
