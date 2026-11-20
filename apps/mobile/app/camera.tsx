import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, AppState, Linking } from 'react-native';
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
import { parseFillDateParam } from '@/features/capture/fillTarget';
import type { LensInfo, Point } from '@/features/capture/cameraZoom';
import { MockCameraPreview } from '@/features/capture/MockCameraPreview';
import { isThreeByFour } from '@/features/capture/cropMath';
import {
  mockLenses,
  parseDevPhotoParam,
  parseMockAccessParam,
  pickDevPhoto,
  takeMockPhoto,
} from '@/features/capture/mockCamera';
import { usePendingCrop } from '@/features/capture/pendingCrop';
import { galleryTarget, saveCapture, saveGalleryPhoto } from '@/features/capture/saveCapture';
import { SlotPicker } from '@/features/capture/SlotPicker';
import { useCameraAccess } from '@/features/capture/useCameraAccess';
import { useCameraZoom } from '@/features/capture/useCameraZoom';
import { useGalleryPicker } from '@/features/capture/useGalleryPicker';
import { useReplaceConfirm } from '@/features/capture/useReplaceConfirm';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { formatTime } from '@/lib/format';
import { currentSlot, localDateIn } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import type { Slot } from '@/theme/tokens';

const MINUTE = 60_000;

// Camera (M2-07, M2-08; FR-CAP-01, FR-CAP-11; designs: Camera, CameraDenied). The shutter queues the photo,
// then opens the editor on it (M2-12). It captures for the open jar only (today, or yesterday's jar while it
// is still open: the travel rule). A past day is filled from the gallery on its own page, never the camera
// (D-153): `?date=` a past day (an old link) opens that day's page instead.
export default function CameraScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const pastDate = parseFillDateParam(date, localDateIn(new Date(), phoneTimeZone()));
  if (pastDate !== null) return <Redirect href={`/day/${pastDate}`} />;
  return <Camera />;
}

function Camera() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ slot?: string; mockAccess?: string; devPhoto?: string }>();
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
  const taken = new Set<Slot>(
    buildTodayGrid({ localDate: jar?.jar?.localDate ?? localDate, moments: jar?.moments ?? [], queue, nowSlot })
      .filter(holdsSlot)
      .map((tile) => tile.slot),
  );
  // The tile that opened the camera picks the slot it opens on. Without a slot param (the hidden Capture
  // route) it is the Now slot, else the first empty one. The moment pill then changes it to another free slot
  // of the open jar (D-151); from then on that choice is the slot, and everything saved goes there.
  const [chosen, setChosen] = useState<Slot | null>(null);
  // #selfie opens on the front lens (D-99); flip still switches. `autoFront` is true while the front lens
  // is the one #selfie chose, not the user: leaving #selfie then goes back to the rear lens (D-151).
  const [facing, setFacing] = useState<CameraFacing>(() =>
    parseSlotParam(params.slot) === 'selfie' ? 'front' : 'back',
  );
  const [autoFront, setAutoFront] = useState(() => parseSlotParam(params.slot) === 'selfie');
  // A new link into the open camera (another slot) starts from its own slot again, and the lens follows it
  // as it does for a picked moment.
  const target = String(params.slot);
  const [chosenFor, setChosenFor] = useState(target);
  if (chosenFor !== target) {
    setChosenFor(target);
    setChosen(null);
    if (parseSlotParam(params.slot) === 'selfie') {
      setFacing('front');
      setAutoFront(true);
    } else if (autoFront) {
      setFacing('back');
      setAutoFront(false);
    }
  }
  const slot = chosen ?? defaultCameraSlot({ param: parseSlotParam(params.slot), nowSlot, taken });
  const [picking, setPicking] = useState(false);
  const [flash, setFlash] = useState<FlashSetting>('off');
  const [flashSupported, setFlashSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const camera = useRef<CameraHandle>(null);
  const replaceConfirm = useReplaceConfirm();

  // Zoom and tap to focus (D-144), for the lenses the camera in use has. Each camera starts at 1× (the wide
  // lens), so a flip resets the zoom.
  const [liveLens, setLiveLens] = useState<LensInfo | null>(null);
  const lens = access === 'mock' ? mockLenses[facing] : access === 'granted' ? liveLens : null;
  const onLiveZoom = useCallback((next: number) => camera.current?.setZoom(next), []);
  const zoom = useCameraZoom(lens, onLiveZoom);
  const onFocus = useCallback((point: Point) => camera.current?.focus(point), []);

  // Change the moment (D-151): same day, new slot. #selfie turns to the front lens; leaving it turns back
  // to the rear one unless the user flipped by hand; any other change keeps the lens. Zoom starts at 1×.
  const { t } = useTranslation();
  const onPickSlot = (next: Slot) => {
    setPicking(false);
    setChosen(next);
    zoom.reset();
    if (next === 'selfie') {
      setFacing('front');
      setAutoFront(true);
    } else if (autoFront) {
      setFacing('back');
      setAutoFront(false);
    }
    AccessibilityInfo.announceForAccessibility(t('camera.slotChanged', { slot: t(`slots.${next}`) }));
  };

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

  // Gallery (M2-08, M2-10; FR-CAP-02): a 3:4 photo is queued like a shot; any other opens Crop first. With
  // Photos access the grid shows each photo's day. A photo from an earlier day goes to that day's jar.
  const gallery = useGalleryPicker({ tz, target: null, insets });
  const devPhoto = parseDevPhotoParam(params.devPhoto, __DEV__);
  const setPendingCrop = usePendingCrop((s) => s.setPending);
  const onGallery = async () => {
    if (busy || userId === null) return;
    setBusy(true);
    try {
      const photo = devPhoto ? await pickDevPhoto(devPhoto) : await gallery.pick();
      if (photo === null) return;
      const openJar = jar?.jar ?? null;
      const target = galleryTarget({ exif: photo.exif, tz, now: new Date(), openJar });
      if (!isThreeByFour(photo)) {
        setPendingCrop({ photo, slot, userId, target });
        router.push('/crop');
        return;
      }
      const visibility = me?.defaultVisibility ?? null;
      const item = await saveGalleryPhoto({
        uri: photo.uri,
        slot,
        userId,
        target,
        crop: null,
        visibility,
        exif: photo.exif,
      });
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
      <>
        <CameraAccessOff
          insets={insets}
          onClose={leave}
          onOpenSettings={() => {
            Linking.openSettings().catch((error: unknown) => captureError(error, { area: 'camera' }));
          }}
          onChooseFromGallery={() => void onGallery()}
        />
        {gallery.modal}
      </>
    );
  }

  const preview =
    access === 'mock' ? (
      <MockCameraPreview facing={facing} factor={zoom.factor} />
    ) : access === 'granted' ? (
      <CameraPreview
        ref={camera}
        facing={facing}
        isActive={focused && foreground && !gallery.open}
        onFlashSupport={setFlashSupported}
        onLens={setLiveLens}
        zoom={zoom.request}
      />
    ) : null;

  return (
    <CameraView
      preview={preview}
      slot={slot}
      time={formatTime(now, tz)}
      flash={flash}
      flashSupported={access === 'mock' || flashSupported}
      shutterDisabled={busy || userId === null || (access !== 'mock' && access !== 'granted')}
      zoom={zoom}
      canFocus={lens?.supportsFocus ?? false}
      onFocus={onFocus}
      insets={insets}
      onClose={leave}
      onChangeSlot={() => setPicking(true)}
      onToggleFlash={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
      onFlip={() => {
        setFacing((f) => (f === 'back' ? 'front' : 'back'));
        setAutoFront(false);
      }}
      onGallery={() => void onGallery()}
      onShutter={() => void onShutter()}
      overlay={
        <>
          {replaceConfirm.dialog}
          {gallery.modal}
          <SlotPicker
            visible={picking}
            current={slot}
            taken={taken}
            onPick={onPickSlot}
            onClose={() => setPicking(false)}
          />
        </>
      }
    />
  );
}

function requireCamera(handle: CameraHandle | null): CameraHandle {
  if (!handle) throw new Error('Camera is not ready');
  return handle;
}
