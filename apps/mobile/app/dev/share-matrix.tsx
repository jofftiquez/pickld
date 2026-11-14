import { Redirect } from 'expo-router';

import { ShareMatrix } from '@/dev/ShareMatrix';

// Dev builds only: release builds redirect away, like /dev/gallery.
export default function ShareMatrixRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ShareMatrix />;
}
