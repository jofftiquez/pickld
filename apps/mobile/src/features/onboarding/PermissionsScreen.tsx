import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { registerPushToken } from '@/features/reminders/pushToken';
import { fetchReminderSettings, reminderQueryKeys } from '@/features/reminders/useReminderSync';
import { useAuthStore } from '@/lib/authStore';
import { formatTime } from '@/lib/format';

import {
  expoPermissionApi,
  PERMISSIONS,
  type PermissionApi,
  type PermissionKind,
  type PermissionState,
} from './permissions';
import { PermissionsView } from './PermissionsView';
import { nextSetupRoute, saveSetupStep } from './setupFlow';

/** A wall-clock time in the phone's locale, e.g. "8:30 AM". */
const clock = (minutes: number) => formatTime(new Date(Date.UTC(2000, 0, 1, 0, minutes)), 'UTC');

/**
 * Permissions: reads each state on open without asking; a system prompt shows only when its Allow is tapped.
 * Continue and Maybe later both move on, and Maybe later never prompts. Allowing notifications saves the
 * push token; Today schedules the reminders on its next open.
 */
export function PermissionsScreen({ api = expoPermissionApi }: { api?: PermissionApi }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [states, setStates] = useState<Record<PermissionKind, PermissionState | null>>({
    camera: null,
    photos: null,
    notifications: null,
  });
  const settings = useQuery({
    queryKey: reminderQueryKeys.settings(userId ?? ''),
    queryFn: () => fetchReminderSettings(userId ?? ''),
    enabled: !!userId,
  });
  const times = (settings.data ?? [])
    .filter((s) => s.enabled)
    .sort((a, b) => a.minutes - b.minutes)
    .map((s) => clock(s.minutes));

  useEffect(() => {
    let alive = true;
    for (const kind of PERMISSIONS) {
      void api.read(kind).then(
        (state) => alive && setStates((s) => ({ ...s, [kind]: state })),
        () => alive && setStates((s) => ({ ...s, [kind]: 'ask' })),
      );
    }
    return () => {
      alive = false;
    };
  }, [api]);

  const onAllow = async (kind: PermissionKind) => {
    if (states[kind] === 'blocked') {
      void Linking.openSettings();
      return;
    }
    const state = await api.request(kind).catch((): PermissionState => 'ask');
    setStates((s) => ({ ...s, [kind]: state }));
    if (kind === 'notifications' && state === 'granted' && userId) {
      void registerPushToken(userId).catch(() => undefined);
    }
  };

  const goNext = async () => {
    if (!userId) return;
    const next = nextSetupRoute('/setup/permissions');
    await saveSetupStep(userId, next);
    if (next) router.push(next);
    else router.replace('/');
  };

  return (
    <PermissionsView
      insets={insets}
      states={states}
      times={times}
      onAllow={(kind) => void onAllow(kind)}
      onContinue={() => void goNext()}
      onLater={() => void goNext()}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
