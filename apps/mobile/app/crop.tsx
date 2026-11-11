import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CropView } from '@/features/capture/CropView';
import {
  clampCrop,
  cropFrame,
  cropRectFor,
  fitCrop,
  flipCrop,
  initialCrop,
  rotateCrop,
  zoomCrop,
  type CropState,
} from '@/features/capture/cropMath';
import { usePendingCrop } from '@/features/capture/pendingCrop';
import { saveGalleryPhoto } from '@/features/capture/saveCapture';
import { todayQueryKeys } from '@/features/jar/useToday';
import { discardRecropPhoto, finishRecrop } from '@/features/moment/recrop';
import { captureError } from '@/lib/monitoring';
import { getSupabase } from '@/lib/supabase';

// Crop (M2-10; FR-CAP-02, FR-CAP-03; design: Crop). The camera opens it on a gallery photo that isn't 3:4.
// Done queues the raw photo with the chosen frame, rotation and flip (preparation applies them and writes
// 1440 × 1920), then opens the editor on it, as the shutter does. Cancel queues nothing.
// Moment options' Re-crop (M2-23) opens it on a saved moment's photo: Save crop replaces the moment's photo
// (see features/moment/recrop.ts) and goes back; Cancel changes nothing.
export default function CropScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const window = useWindowDimensions();
  const pending = usePendingCrop((s) => s.pending);
  const setPending = usePendingCrop((s) => s.setPending);
  const [state, setState] = useState<CropState>(initialCrop);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  // Opened without a photo (a deep link, or the app restarted here): nothing to crop. Checked once, on
  // open: Cancel and Done clear the photo themselves as they leave.
  useEffect(() => {
    if (usePendingCrop.getState().pending === null) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (pending === null) return null;

  const { photo } = pending;
  const image = { width: photo.width, height: photo.height };
  // The same frame CropView draws, so the rectangle matches what the user sees.
  const frame = cropFrame(window);

  const onCancel = () => {
    discardRecropPhoto(pending);
    setPending(null);
    leave();
  };

  const onSaveRecrop = async (recrop: Extract<typeof pending, { recrop: object }>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const rect = cropRectFor(state, image, frame);
    try {
      await finishRecrop(getSupabase(), recrop, {
        crop: rect,
        cropBasis: image,
        rotate: state.rotation,
        flip: state.flip,
      });
    } catch (error) {
      captureError(error, { area: 'recrop' });
      setBusy(false);
      setFailed(true);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(recrop.userId) });
    void queryClient.invalidateQueries({ queryKey: ['jar', recrop.userId] });
    setPending(null);
    leave();
  };

  const onDone = async () => {
    if (pending.recrop) return onSaveRecrop(pending);
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const rect = cropRectFor(state, image, frame);
    let queuedId: number | null = null;
    try {
      const item = await saveGalleryPhoto({
        uri: photo.uri,
        slot: pending.slot,
        userId: pending.userId,
        target: pending.target,
        crop: { crop: rect, cropBasis: image, rotate: state.rotation, flip: state.flip },
      });
      queuedId = item.id;
    } catch (error) {
      captureError(error, { area: 'gallery' });
    }
    void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(pending.userId) });
    if (queuedId === null) {
      setBusy(false);
      setFailed(true);
      return;
    }
    setPending(null);
    router.replace(`/edit/${queuedId}`);
  };

  return (
    <CropView
      uri={photo.uri}
      image={image}
      slotLabel={t(`slots.${pending.slot}`)}
      state={state}
      busy={busy}
      failed={failed}
      mode={pending.recrop ? 'recrop' : 'gallery'}
      insets={insets}
      onChange={setState}
      onZoom={(zoom) => setState((s) => zoomCrop(s, zoom, image, frame))}
      onRotate={() => setState((s) => clampCrop(rotateCrop(s), image, frame))}
      onFlip={() => setState((s) => clampCrop(flipCrop(s), image, frame))}
      onFit={() => setState(fitCrop)}
      onReset={() => setState(initialCrop)}
      onCancel={onCancel}
      onDone={() => void onDone()}
    />
  );
}
