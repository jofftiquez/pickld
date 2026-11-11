import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import type { CameraFacing } from './CameraPreview';
import { mockPhotos } from './mockCamera';

/** Dev-only stand-in for the live viewfinder on the Simulator (T-106): a bundled photo per lens. */
export function MockCameraPreview({ facing }: { facing: CameraFacing }) {
  const { t } = useTranslation();
  return (
    <Image
      source={mockPhotos[facing]}
      contentFit="cover"
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityLabel={t('camera.mockPreview')}
      testID="camera-mock-preview"
    />
  );
}
