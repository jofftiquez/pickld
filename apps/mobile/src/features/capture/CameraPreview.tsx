import { useEffect, useImperativeHandle, useMemo, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  usePhotoOutput,
  type Constraint,
} from 'react-native-vision-camera';

export type CameraFacing = 'back' | 'front';
export type FlashSetting = 'off' | 'on';

/** What the Camera screen needs from a preview: take a photo and get a local file URI back. */
export type CameraHandle = { takePhoto(flash: FlashSetting): Promise<string> };

export type CameraPreviewProps = {
  facing: CameraFacing;
  /** False while the screen is hidden or the app is in the background, so the camera stops. */
  isActive: boolean;
  /** Reports whether the current lens has a flash (front cameras usually don't). */
  onFlashSupport: (hasFlash: boolean) => void;
  ref?: Ref<CameraHandle>;
};

const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

/**
 * Live viewfinder (react-native-vision-camera). The photo output asks for a 4:3 sensor format at
 * 1440 × 1920 (the size the pipeline writes), and the session is biased to that output so the
 * preview uses the same 4:3 format; the parent frames it as 3:4 portrait with `cover`.
 */
export function CameraPreview({ facing, isActive, onFlashSupport, ref }: CameraPreviewProps) {
  const device = useCameraDevice(facing);
  // `speed` keeps the shutter-to-next-screen path short (FR-CAP-01: under 1 s).
  // JPEG, not the device default HEIC: Skia's useImage (editor) can't decode HEIC.
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.FHD_4_3,
    qualityPrioritization: 'speed',
    containerFormat: 'jpeg',
  });
  const constraints = useMemo<Constraint[]>(() => [{ resolutionBias: photoOutput }], [photoOutput]);
  const hasFlash = device?.hasFlash ?? false;

  useEffect(() => onFlashSupport(hasFlash), [hasFlash, onFlashSupport]);

  useImperativeHandle(
    ref,
    () => ({
      async takePhoto(flash) {
        const file = await photoOutput.capturePhotoToFile({ flashMode: hasFlash ? flash : 'off' }, {});
        return toFileUri(file.filePath);
      },
    }),
    [photoOutput, hasFlash],
  );

  if (!device) return null;
  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={[photoOutput]}
      constraints={constraints}
      isActive={isActive}
      resizeMode="cover"
      // 'auto' mirrors the front camera's preview and its photo alike, so a selfie is saved the way it was
      // seen (Mirror selfies on, the default). With the switch off, the photo is flipped back after it is
      // taken (saveCapture), and the preview stays mirrored, as in the iPhone Camera (D-66).
      mirrorMode="auto"
    />
  );
}
