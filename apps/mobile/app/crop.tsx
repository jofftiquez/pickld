import { useLocalSearchParams } from 'expo-router';

import { MomentCropScreen } from '@/features/capture/MomentCropScreen';
import { ProfileCropScreen } from '@/features/profile/ProfileCropScreen';

// /crop (design: Crop). Without a mode it crops a moment at 3:4: the camera's gallery photo (M2-10) or
// Moment options' Re-crop (M2-23). `mode=avatar` or `mode=cover` frames Edit profile's new photo as a
// square or at the cover's 5:2 (D-79). Either way the photo waits in a store, not in the route.
export default function CropScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return mode === 'avatar' || mode === 'cover' ? <ProfileCropScreen kind={mode} /> : <MomentCropScreen />;
}
