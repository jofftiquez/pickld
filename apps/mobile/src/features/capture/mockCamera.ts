// Dev mock camera (T-106): the iOS Simulator and emulators have no usable camera, so in development
// builds the Camera screen shows a bundled photo as its preview and the shutter "takes" that photo.
// Never used in release builds (`__DEV__` is false there).
import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';
import { Image } from 'react-native';

import type { CameraFacing } from './CameraPreview';
import type { PickedPhoto } from './pickFromGallery';

export const mockPhotos: Record<CameraFacing, number> = {
  back: require('../../../assets/dev/whereami.jpg'),
  front: require('../../../assets/dev/selfie.jpg'),
};

/**
 * Whether to use the mock camera: only in development, on a simulator or emulator (no camera
 * hardware), or when the camera list came back empty (`hasCameraDevice === false`).
 */
export function shouldUseMockCamera(input: {
  isDev: boolean;
  isDevice: boolean | null;
  hasCameraDevice: boolean | null;
}): boolean {
  return input.isDev && (input.isDevice === false || input.hasCameraDevice === false);
}

/**
 * Dev-only `?mockAccess=denied` on the Camera route: forces the Camera access off screen, so Maestro
 * can show it on a Simulator (where the mock camera never asks for permission). Ignored in release.
 */
export function parseMockAccessParam(value: unknown, isDev: boolean): 'denied' | null {
  return isDev && value === 'denied' ? 'denied' : null;
}

/** `shouldUseMockCamera` for this app run, before any camera device is queried. */
export function isSimulatorDevBuild(): boolean {
  return shouldUseMockCamera({ isDev: __DEV__, isDevice: Device.isDevice, hasCameraDevice: null });
}

/**
 * A local file holding a bundled asset. In development the asset is served by Metro over HTTP, so it is
 * downloaded into the cache first.
 */
async function assetFile(asset: number, prefix: string): Promise<string> {
  const uri = Image.resolveAssetSource(asset)?.uri ?? '';
  if (!/^https?:/.test(uri)) return uri;
  const dest = new File(Paths.cache, `${prefix}-${Date.now().toString(36)}.jpg`);
  const file = await File.downloadFileAsync(uri, dest, { idempotent: true });
  return file.uri;
}

/** A local file holding the mock photo, as a camera capture would return. */
export async function takeMockPhoto(facing: CameraFacing): Promise<string> {
  return assetFile(mockPhotos[facing], 'mock-camera');
}

/** Bundled photos the dev gallery can "pick": 3:2 landscape and square open Crop; 3:4 skips it. */
export const devGalleryPhotos = {
  wide: require('../../../assets/dev/wide.jpg'),
  square: require('../../../assets/dev/av_dale.jpg'),
  portrait: require('../../../assets/dev/morning.jpg'),
} as const satisfies Record<string, number>;
export type DevGalleryPhoto = keyof typeof devGalleryPhotos;

/**
 * Dev-only `?devPhoto=wide|square|portrait` on the Camera route: the gallery button picks that bundled
 * photo instead of opening the system picker, so Maestro can reach the Crop screen deterministically on a
 * Simulator. Ignored in release.
 */
export function parseDevPhotoParam(value: unknown, isDev: boolean): DevGalleryPhoto | null {
  return isDev && typeof value === 'string' && Object.hasOwn(devGalleryPhotos, value)
    ? (value as DevGalleryPhoto)
    : null;
}

/** The bundled photo as the picker would return it: a local file and its size, with no EXIF (taken now). */
export async function pickDevPhoto(name: DevGalleryPhoto): Promise<PickedPhoto> {
  const asset = devGalleryPhotos[name];
  const { width = 0, height = 0 } = Image.resolveAssetSource(asset) ?? {};
  return { uri: await assetFile(asset, 'dev-gallery'), width, height, exif: null };
}
