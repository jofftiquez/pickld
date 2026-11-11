import * as Device from 'expo-device';
import { useEffect, useState } from 'react';
import { useCameraPermission, VisionCamera } from 'react-native-vision-camera';

import { isSimulatorDevBuild, shouldUseMockCamera } from './mockCamera';

/**
 * - `mock`: development build without a camera (Simulator): show the dev mock, never ask for permission.
 * - `asking`: the permission prompt is up (first open).
 * - `granted`: show the live camera.
 * - `denied`: denied or restricted in Settings (the full screen is M2-08).
 */
export type CameraAccess = 'mock' | 'asking' | 'granted' | 'denied';

/** Camera permission for the Camera screen: asks on first open, unless the dev mock camera is used. */
export function useCameraAccess(): CameraAccess {
  const simulator = isSimulatorDevBuild();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [hasCameraDevice, setHasCameraDevice] = useState<boolean | null>(null);

  // A development build on a device with no cameras also gets the mock. Release builds never look.
  useEffect(() => {
    if (!__DEV__ || simulator) return;
    let alive = true;
    VisionCamera.createDeviceFactory().then(
      (factory) => alive && setHasCameraDevice(factory.cameraDevices.length > 0),
      () => alive && setHasCameraDevice(false),
    );
    return () => {
      alive = false;
    };
  }, [simulator]);

  const mock = shouldUseMockCamera({ isDev: __DEV__, isDevice: Device.isDevice, hasCameraDevice });

  useEffect(() => {
    if (!mock && canRequestPermission) void requestPermission();
  }, [mock, canRequestPermission, requestPermission]);

  if (mock) return 'mock';
  if (hasPermission) return 'granted';
  return canRequestPermission ? 'asking' : 'denied';
}
