import { Redirect } from 'expo-router';

import { Gallery } from '@/dev/Gallery';

// Dev builds only: release builds redirect away, so the gallery never reaches users.
export default function GalleryRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}
