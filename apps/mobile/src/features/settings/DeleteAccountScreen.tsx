import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { DeleteAccountView } from './DeleteAccountView';
import { exportCard, exportStatus, type ExportStatus } from './deleteModel';
import { signOutHere } from './signOut';

// /settings/delete (M4-19): Delete account, over fn:data-export and fn:account-delete (M4-18). Deleting hides
// the profile at once on the server; this phone then signs out.

const deleteKeys = {
  counts: (userId: string) => ['deleteAccount', 'counts', userId] as const,
  export: (userId: string) => ['deleteAccount', 'export', userId] as const,
};

async function fetchCounts(userId: string): Promise<{ jars: number; moments: number }> {
  const supabase = getSupabase();
  const [profile, moments] = await Promise.all([
    supabase.from('profiles').select('jar_count').eq('id', userId).single(),
    supabase
      .from('moments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'removed'),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (moments.error) throw new Error(moments.error.message);
  return { jars: z.number().parse(profile.data.jar_count), moments: moments.count ?? 0 };
}

async function callExport(method: 'GET' | 'POST'): Promise<ExportStatus> {
  const { data, error } = await getSupabase().functions.invoke<unknown>('data-export', { method });
  if (error) throw error;
  return z.object({ data: exportStatus }).parse(data).data;
}

export function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id) ?? '';
  const counts = useQuery({ queryKey: deleteKeys.counts(userId), queryFn: () => fetchCounts(userId) });
  const status = useQuery({
    queryKey: deleteKeys.export(userId),
    queryFn: () => callExport('GET'),
    // While it's being prepared, look again every half minute.
    refetchInterval: (q) => (q.state.data?.status === 'pending' || q.state.data?.status === 'running' ? 30_000 : false),
  });
  const requestExport = useMutation({
    mutationFn: () => callExport('POST'),
    onSuccess: (next) => queryClient.setQueryData(deleteKeys.export(userId), next),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().functions.invoke('account-delete', { method: 'POST' });
      if (error) throw error;
    },
    onSuccess: async () => {
      await signOutHere(queryClient);
      router.replace('/welcome');
    },
  });

  return (
    <DeleteAccountView
      insets={insets}
      counts={counts.data ?? null}
      exportCard={exportCard(status.data)}
      exportBusy={requestExport.isPending}
      deleting={remove.isPending}
      error={remove.isError ? 'delete' : requestExport.isError ? 'export' : null}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onRequestExport={() => requestExport.mutate()}
      onOpenExport={(url) => void WebBrowser.openBrowserAsync(url)}
      onDelete={() => remove.mutate()}
    />
  );
}
