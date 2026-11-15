import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import type { CameraFacing } from './CameraPreview';
import { mockPhotos } from './mockCamera';

/**
 * Dev-only stand-in for the live viewfinder on the Simulator (T-106): a bundled photo per lens. Zooming in
 * (`factor` above 1×) enlarges it, so pinch and the zoom buttons can be seen working.
 */
export function MockCameraPreview({ facing, factor = 1 }: { facing: CameraFacing; factor?: number }) {
  const { t } = useTranslation();
  return (
    <Image
      source={mockPhotos[facing]}
      contentFit="cover"
      style={[StyleSheet.absoluteFill, { transform: [{ scale: Math.max(1, factor) }] }]}
      accessible
      accessibilityLabel={t('camera.mockPreview')}
      testID="camera-mock-preview"
    />
  );
}
