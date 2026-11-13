// Tapping a server push (FR-NOT-02, FR-NOT-03) opens the screen its Notifications row opens, once signed
// in: a comment on a moment opens that moment's thread (0068; D-51). The push that launched the app counts
// too. Slot reminders carry no server data and just open the app.
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { pushTarget } from './notificationsModel';

export function usePushTaps(enabled: boolean) {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!enabled || !response) return;
    const target = pushTarget(response.notification.request.content.data);
    // Handled once: a later render or launch doesn't open it again.
    Notifications.clearLastNotificationResponse();
    if (target) router.push(target);
  }, [enabled, response, router]);
}
