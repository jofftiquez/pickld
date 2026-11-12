import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBlockedAccounts } from '@/features/safety/block';
import { openLegal } from '@/lib/auth';
import { useAuthStore } from '@/lib/authStore';

import { SettingsView } from './SettingsView';
import { signOutHere } from './signOut';
import { useSettings } from './useSettings';

/** /settings (M4-16): wires Settings to the user's data, the reminder schedule and sign-out. */
export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? '';
  const { account, reminders, prefs, saveReminder, savePref, saveVisibility } = useSettings(userId);
  const blocked = useBlockedAccounts();
  const [saveFailed, setSaveFailed] = useState(false);
  const onSaved = { onError: () => setSaveFailed(true), onSuccess: () => setSaveFailed(false) };

  async function signOut() {
    await signOutHere(queryClient);
    router.replace('/welcome');
  }

  return (
    <SettingsView
      insets={insets}
      account={account.data}
      email={session?.user.email ?? null}
      reminders={reminders.data}
      prefs={prefs.data}
      blockedCount={blocked.rows?.length}
      version={Constants.expoConfig?.version ?? ''}
      failed={account.isError || reminders.isError || prefs.isError}
      saveFailed={saveFailed}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onRetry={() => {
        void account.refetch();
        void reminders.refetch();
        void prefs.refetch();
      }}
      onEditProfile={() => router.push('/settings/profile')}
      onReminder={(slot, change) => saveReminder.mutate({ slot, ...change }, onSaved)}
      onPref={(key, value) => savePref.mutate({ key, value }, onSaved)}
      onVisibility={(v) => saveVisibility.mutate(v, onSaved)}
      onBlocked={() => router.push('/settings/blocked')}
      onMyStickers={() => router.push('/stickers/mine')}
      onHelp={() => router.push('/settings/help')}
      onLegal={() => openLegal('terms')}
      onSignOut={() => void signOut()}
      onDelete={() => router.push('/settings/delete')}
    />
  );
}
