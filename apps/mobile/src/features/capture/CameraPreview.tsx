import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  usePhotoOutput,
  type CameraRef,
  type Constraint,
  type DeviceFilter,
} from 'react-native-vision-camera';

import { captureError } from '@/lib/monitoring';

import { lensInfo, zoomPlan, type LensInfo, type Point, type ZoomRequest } from './cameraZoom';

export type CameraFacing = 'back' | 'front';
export type FlashSetting = 'off' | 'on';

/** What the Camera screen needs from a preview: take a photo, focus on a point, and follow a pinch. */
export type CameraHandle = {
  takePhoto(flash: FlashSetting): Promise<string>;
  /** Focus (and meter exposure and white balance, where the lens can) at a point in the preview. */
  focus(point: Point): void;
  /** Sets the zoom at once, for each pinch step; the `zoom` prop takes over when the pinch ends. */
  setZoom(zoom: number): void;
};

export type CameraPreviewProps = {
  facing: CameraFacing;
  /** False while the screen is hidden or the app is in the background, so the camera stops. */
  isActive: boolean;
  /** Reports whether the current lens has a flash (front cameras usually don't). */
  onFlashSupport: (hasFlash: boolean) => void;
  /** Reports the lenses behind the current camera, for the zoom buttons and tap to focus (D-144). */
  onLens: (lens: LensInfo | null) => void;
  /** The zoom to hold; one meant for another camera is ignored, and the camera sits at 1× (the wide lens). */
  zoom: ZoomRequest | undefined;
  ref?: Ref<CameraHandle>;
};

// The back camera is opened as one device over all its lenses (ultra-wide, wide, telephoto: the iPhone's
// "triple" camera), so zoom moves across lenses the way the iPhone Camera does (D-144). A phone with fewer
// lenses gets the device with the most of them; a single-lens phone gets its wide camera. The front camera
// keeps the default (its wide camera, not the depth camera).
const BACK_LENSES: DeviceFilter = { physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'] };

const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);
const report = (error: unknown) => captureError(error, { area: 'camera' });

/**
 * Live viewfinder (react-native-vision-camera). The photo output asks for a 4:3 sensor format at
 * 1440 × 1920 (the size the pipeline writes), and the session is biased to that output so the
 * preview uses the same 4:3 format; the parent frames it as 3:4 portrait with `cover`.
 */
export function CameraPreview({ facing, isActive, onFlashSupport, onLens, zoom, ref }: CameraPreviewProps) {
  const device = useCameraDevice(facing, facing === 'back' ? BACK_LENSES : undefined);
  const camera = useRef<CameraRef>(null);
  // `speed` keeps the shutter-to-next-screen path short (FR-CAP-01: under 1 s).
  // JPEG, not the device default HEIC: Skia's useImage (editor) can't decode HEIC.
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.FHD_4_3,
    qualityPrioritization: 'speed',
    containerFormat: 'jpeg',
  });
  const constraints = useMemo<Constraint[]>(() => [{ resolutionBias: photoOutput }], [photoOutput]);
  const hasFlash = device?.hasFlash ?? false;
  const lens = useMemo(() => (device ? lensInfo(device) : null), [device]);
  // Until the screen asks for a zoom on this camera, hold it at 1× (vision-camera's default zoom of 1 is the
  // ultra-wide on a multi-lens camera).
  const zoomFactor = lens ? (zoom?.lens === lens ? zoom.zoom : zoomPlan(lens).neutral) : undefined;

  useEffect(() => onFlashSupport(hasFlash), [hasFlash, onFlashSupport]);
  useEffect(() => onLens(lens), [lens, onLens]);

  useImperativeHandle(
    ref,
    () => ({
      async takePhoto(flash) {
        const file = await photoOutput.capturePhotoToFile({ flashMode: hasFlash ? flash : 'off' }, {});
        return toFileUri(file.filePath);
      },
      focus(point) {
        // A lens that can't focus on a point (lens.supportsFocus) never gets here; a camera that isn't
        // ready yet just skips the tap.
        camera.current?.focusTo(point).catch(report);
      },
      setZoom(next) {
        camera.current?.controller?.setZoom(next).catch(report);
      },
    }),
    [photoOutput, hasFlash],
  );

  if (!device) return null;
  return (
    <Camera
      ref={camera}
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={[photoOutput]}
      constraints={constraints}
      isActive={isActive}
      zoom={zoomFactor}
      onError={report}
      resizeMode="cover"
      // 'auto' mirrors the front camera's preview and its photo alike, so a selfie is saved the way it was
      // seen (Mirror selfies on, the default). With the switch off, the photo is flipped back after it is
      // taken (saveCapture), and the preview stays mirrored, as in the iPhone Camera (D-66).
      mirrorMode="auto"
    />
  );
}
