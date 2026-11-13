import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraAccessOff } from '@/features/capture/CameraAccessOff';
import { getMirrorSelfies } from '@/features/capture/cameraPrefs';
import {
  CameraPreview,
  type CameraFacing,
  type CameraHandle,
  type FlashSetting,
} from '@/features/capture/CameraPreview';
import { CameraView } from '@/features/capture/CameraView';
import { defaultCameraSlot, parseSlotParam } from '@/features/capture/cameraSlot';
import { fillCameraSlot } from '@/features/capture/fillTarget';
import { MockCameraPreview } from '@/features/capture/MockCameraPreview';
import { isThreeByFour } from '@/features/capture/cropMath';
import { parseDevPhotoParam, parseMockAccessParam, pickDevPhoto, takeMockPhoto } from '@/features/capture/mockCamera';
import { usePendingCrop } from '@/features/capture/pendingCrop';
import { pickFromGallery } from '@/features/capture/pickFromGallery';
import { galleryTarget, saveCapture, saveGalleryPhoto } from '@/features/capture/saveCapture';
import { useCameraAccess } from '@/features/capture/useCameraAccess';
import { useFillCapture } from '@/features/capture/useFillCapture';
import { useReplaceConfirm } from '@/features/capture/useReplaceConfirm';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { formatTime } from '@/lib/format';
import { currentSlot } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { slots, type Slot } from '@/theme/tokens';

const MINUTE = 60_000;

// Camera (M2-07, M2-08; FR-CAP-01, FR-CAP-11; designs: Camera, CameraDenied). The shutter queues the photo,
// then opens the editor on it (M2-12).
export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ slot?: string; date?: string; mockAccess?: string; devPhoto?: string }>();
  const cameraAccess = useCameraAccess();
  const access = parseMockAccessParam(params.mockAccess, __DEV__) ?? cameraAccess;

  // The slot tag's clock, on the minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        MINUTE - (Date.now() % MINUTE),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // Slots already taken in the open jar (server moments and queued photos), from Today's queries.
  const tz = phoneTimeZone();
  const { userId, localDate, jar, queue, me } = useToday(now);
  const nowSlot = currentSlot(now, tz);
  // Fill this jar (`?date=` a past day, M2-26): that day's jar and its missing slots instead of the open jar.
  const fill = useFillCapture(params.date, localDate, tz);
  const taken =
    fill?.taken ??
    new Set<Slot>(
      buildTodayGrid({ localDate: jar?.jar?.localDate ?? localDate, moments: jar?.moments ?? [], queue, nowSlot })
        .filter(holdsSlot)
        .map((tile) => tile.slot),
    );
  // The tile that opened the camera picks the slot; there is no switcher (QA item 5). Without a slot param
  // (the hidden Capture route) it is the Now slot, else the first empty one.
  const fillSlot = fill ? fillCameraSlot({ param: parseSlotParam(params.slot), taken }) : null;
  const slot = fill
    ? (fillSlot ?? slots[0])
    : defaultCameraSlot({ param: parseSlotParam(params.slot), nowSlot, taken });
  // A full past jar has nothing to fill.
  const fillFull = fill !== null && fillSlot === null;

  const [facing, setFacing] = useState<CameraFacing>('back');
  const [flash, setFlash] = useState<FlashSetting>('off');
  const [flashSupported, setFlashSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const camera = useRef<CameraHandle>(null);
  const replaceConfirm = useReplaceConfirm();

  // The camera runs only while this screen is visible and the app is in the foreground.
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state !== 'background'));
    return () => sub.remove();
  }, []);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  const onShutter = async () => {
    if (busy || userId === null) return;
    // A filled slot asks first; Replace keeps the old photo until the new one is live (M2-22).
    const replace = taken.has(slot);
    if (replace && !(await replaceConfirm.confirm(slot))) return;
    setBusy(true);
    const shotAt = new Date();
    let uri: string;
    try {
      uri = access === 'mock' ? await takeMockPhoto(facing) : await requireCamera(camera.current).takePhoto(flash);
    } catch (error) {
      captureError(error, { area: 'camera' });
      setBusy(false);
      return;
    }
    // Queue the raw photo before leaving, so it survives the app being killed now; preparing runs behind
    // the editor, and the upload waits for it.
    const openJar = jar?.jar ?? null;
    let queuedId: number | null = null;
    try {
      // Mirror selfies off (D-66): a front-camera photo is flipped back to how the scene really looks. A
      // store that can't be read keeps the default (on), so the photo is still queued.
      const flip = facing === 'front' && !(await getMirrorSelfies().catch(() => true));
      const visibility = me?.defaultVisibility ?? null; // D-48: a new moment starts at the owner's default
      queuedId = (
        await saveCapture({
          uri,
          slot,
          userId,
          tz,
          shotAt,
          openJar,
          fill: fill?.target ?? null,
          replace,
          flip,
          visibility,
        })
      ).id;
    } catch (error) {
      captureError(error, { area: 'capture' });
    }
    void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
    if (queuedId === null) leave();
    else router.replace(`/edit/${queuedId}`);
  };

  // Gallery (M2-08, M2-10; FR-CAP-02): a 3:4 photo is queued like a shot; any other opens Crop first.
  const devPhoto = parseDevPhotoParam(params.devPhoto, __DEV__);
  const setPendingCrop = usePendingCrop((s) => s.setPending);
  const onGallery = async () => {
    if (busy || userId === null || fillFull) return;
    setBusy(true);
    try {
      const photo = devPhoto ? await pickDevPhoto(devPhoto) : await pickFromGallery();
      if (photo === null) return;
      const openJar = jar?.jar ?? null;
      const target = galleryTarget({ exif: photo.exif, tz, now: new Date(), openJar, fill: fill?.target ?? null });
      if (!isThreeByFour(photo)) {
        setPendingCrop({ photo, slot, userId, target });
        router.push('/crop');
        return;
      }
      const visibility = me?.defaultVisibility ?? null;
      const item = await saveGalleryPhoto({ uri: photo.uri, slot, userId, target, crop: null, visibility });
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      router.replace(`/edit/${item.id}`);
    } catch (error) {
      captureError(error, { area: 'gallery' });
    } finally {
      setBusy(false);
    }
  };

  if (access === 'denied') {
    return (
      <CameraAccessOff
        insets={insets}
        onClose={leave}
        onOpenSettings={() => {
          Linking.openSettings().catch((error: unknown) => captureError(error, { area: 'camera' }));
        }}
        onChooseFromGallery={() => void onGallery()}
      />
    );
  }

  const preview =
    access === 'mock' ? (
      <MockCameraPreview facing={facing} />
    ) : access === 'granted' ? (
      <CameraPreview ref={camera} facing={facing} isActive={focused && foreground} onFlashSupport={setFlashSupported} />
    ) : null;

  return (
    <CameraView
      preview={preview}
      slot={slot}
      time={formatTime(now, tz)}
      date={fill?.dateLabel}
      flash={flash}
      flashSupported={access === 'mock' || flashSupported}
      shutterDisabled={busy || userId === null || fillFull || (access !== 'mock' && access !== 'granted')}
      insets={insets}
      onClose={leave}
      onToggleFlash={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
      onFlip={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
      onGallery={() => void onGallery()}
      onShutter={() => void onShutter()}
      overlay={replaceConfirm.dialog}
    />
  );
}

function requireCamera(handle: CameraHandle | null): CameraHandle {
  if (!handle) throw new Error('Camera is not ready');
  return handle;
}
