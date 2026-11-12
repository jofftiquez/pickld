// Ending the session on this phone (Settings → Sign out, and after Delete account). The phone stops
// getting this account's reminders and pushes first, so the next account on it never gets them.
import type { QueryClient } from '@tanstack/react-query';

import { removePushToken } from '@/features/reminders/pushToken';
import { cancelAllReminders, expoReminderApi } from '@/features/reminders/syncReminders';
import { getSupabase } from '@/lib/supabase';

export async function signOutHere(queryClient: QueryClient): Promise<void> {
  await cancelAllReminders(expoReminderApi).catch(() => undefined);
  await removePushToken().catch(() => undefined);
  await getSupabase().auth.signOut({ scope: 'local' });
  queryClient.clear();
}
