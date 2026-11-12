import { Redirect } from 'expo-router';

import { DevNotifications } from '@/dev/DevNotifications';

// Dev builds only: release builds redirect away, like /dev/gallery.
export default function DevNotificationsRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevNotifications />;
}
