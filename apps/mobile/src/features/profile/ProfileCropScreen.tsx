import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CropView } from '@/features/capture/CropView';
import { CROP_RATIO, cropFrame, cropRectFor, initialCrop, zoomCrop, type CropState } from '@/features/capture/cropMath';
import type { ProfileImageKind } from '@/lib/image/profileImage';

import { settleProfileCrop, useProfileCrop } from './profileCrop';

export type ProfileCropScreenProps = { kind: ProfileImageKind };

/**
 * /crop?mode=avatar|cover (D-79; FR-SOC-11; design: Crop): Edit profile's Change photo or Change cover frames
 * the picked photo, a square under a circle guide or the cover's 5:2 band, with pan and zoom only. Done
 * hands the frame (in the picker's pixels) back to Edit profile, which prepares and uploads it; Cancel, or
 * leaving any other way, hands back nothing, so the profile stays as it was.
 */
export function ProfileCropScreen({ kind }: ProfileCropScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const request = useProfileCrop((s) => s.request);
  const [state, setState] = useState<CropState>(initialCrop);
  // The request this screen opened on: settled with null if the screen goes without Done or Cancel.
  const opened = useRef(request?.id ?? null);
  // Done or Cancel pressed: a second press mustn't go back past Edit profile.
  const left = useRef(false);

  const leave = () => {
    if (left.current) return;
    left.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  useEffect(() => {
    // Opened without a photo (a deep link, or the app restarted here), or for another shape: nothing to crop.
    if (request === null || request.kind !== kind) leave();
    const id = opened.current;
    return () => {
      if (id !== null) settleProfileCrop(id, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (request === null || request.kind !== kind) return null;

  const { photo } = request;
  const image = { width: photo.width, height: photo.height };
  const ratio = CROP_RATIO[kind];
  // The same frame CropView draws, so the rectangle matches what the person sees.
  const frame = cropFrame(window, insets, ratio);

  const onCancel = () => {
    if (left.current) return;
    settleProfileCrop(request.id, null);
    leave();
  };

  const onDone = () => {
    if (left.current) return;
    settleProfileCrop(request.id, { rect: cropRectFor(state, image, frame, ratio), basis: image });
    leave();
  };

  return (
    <CropView
      uri={photo.uri}
      image={image}
      slotLabel=""
      state={state}
      busy={false}
      failed={false}
      mode={kind}
      insets={insets}
      onChange={setState}
      onZoom={(zoom) => setState((s) => zoomCrop(s, zoom, image, frame))}
      onReset={() => setState(initialCrop)}
      onCancel={onCancel}
      onDone={onDone}
    />
  );
}
