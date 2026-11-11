import { Redirect } from 'expo-router';

import { DevSignIn } from '@/dev/DevSignIn';

// Dev builds only: release builds redirect away, like /dev/gallery.
export default function DevSignInRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevSignIn />;
}
