// Push tokens for server pushes (FR-NOT-02; fn:send-push, M3-17). Once notifications are allowed (the
// Permissions screen asks, M4-07), the device's Expo push token is saved to push_tokens as the user (RLS:
// push_tokens_owner), one row per device. Simulators have no push token, and neither does a build without
// an EAS project id; both skip quietly. A token moving to another account moves with an upsert on the token.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

const projectIdSchema = z.uuid();

/** The EAS project id from app config, or null before the project is set up. */
export function easProjectId(extra: unknown = Constants.expoConfig?.extra): string | null {
  const parsed = z.object({ eas: z.object({ projectId: projectIdSchema }) }).safeParse(extra);
  return parsed.success ? parsed.data.eas.projectId : null;
}

/** Whether notifications are allowed (iOS provisional counts). Never asks. */
export async function notificationsAllowed(): Promise<boolean> {
  const status = await Notifications.getPermissionsAsync();
  return status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

/** Saves this device's push token for `userId`; resolves `skipped` when there is none to save. */
export async function registerPushToken(userId: string): Promise<'saved' | 'skipped'> {
  const projectId = easProjectId();
  if (!Device.isDevice || projectId === null || !(await notificationsAllowed())) return 'skipped';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await getSupabase()
    .from('push_tokens')
    .upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
  if (error) throw new Error(error.message);
  return 'saved';
}

/**
 * At sign-out: forget this device's token, so the next account on the phone never gets the last one's
 * pushes. TODO(M4-16, #106): call from Settings → Sign out, with cancelAllReminders.
 */
export async function removePushToken(): Promise<void> {
  const projectId = easProjectId();
  if (!Device.isDevice || projectId === null) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await getSupabase().from('push_tokens').delete().eq('token', token);
  if (error) throw new Error(error.message);
}
