import { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera,
  isScannedCode,
  useCameraDevice,
  useObjectOutput,
  type ScannedObject,
  type ScannedObjectType,
} from 'react-native-vision-camera';

// Stable, so useObjectOutput keeps one output (it rebuilds when the array changes).
const QR: ScannedObjectType[] = ['qr'];

export type ScanPreviewProps = {
  /** False while the screen is hidden or the app is in the background, so the camera stops. */
  isActive: boolean;
  torch: boolean;
  /** Reports whether the back camera has a light. */
  onTorchSupport: (hasTorch: boolean) => void;
  /** Called with the text of every QR code in view, often several times a second. */
  onCode: (value: string) => void;
};

/** The back camera looking for QR codes (Scan QR, INV-06; react-native-vision-camera's object output). */
export function ScanPreview({ isActive, torch, onTorchSupport, onCode }: ScanPreviewProps) {
  const device = useCameraDevice('back');
  const hasTorch = device?.hasTorch ?? false;
  useEffect(() => onTorchSupport(hasTorch), [hasTorch, onTorchSupport]);

  const onObjectsScanned = useCallback(
    (objects: ScannedObject[]) => {
      for (const o of objects) if (isScannedCode(o) && o.value) onCode(o.value);
    },
    [onCode],
  );
  const output = useObjectOutput({ types: QR, onObjectsScanned });

  if (!device) return null;
  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={[output]}
      isActive={isActive}
      torchMode={torch && hasTorch ? 'on' : 'off'}
      resizeMode="cover"
    />
  );
}
