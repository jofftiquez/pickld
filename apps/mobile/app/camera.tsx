import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraAccessOff } from '@/features/capture/CameraAccessOff';
import {
  CameraPreview,
  type CameraFacing,
  type CameraHandle,
  type FlashSetting,
} from '@/features/capture/CameraPreview';
import { CameraView } from '@/features/capture/CameraView';
import { defaultCameraSlot, parseSlotParam, switchSlot } from '@/features/capture/cameraSlot';
import { MockCameraPreview } from '@/features/capture/MockCameraPreview';
import { takeMockPhoto } from '@/features/capture/mockCamera';
import { saveCapture } from '@/features/capture/saveCapture';
import { useCameraAccess } from '@/features/capture/useCameraAccess';
import { buildTodayGrid } from '@/features/jar/todayGrid';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { formatTime } from '@/lib/format';
import { currentSlot } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { useReduceMotion } from '@/lib/useReduceMotion';
import type { Slot } from '@/theme/tokens';

const MINUTE = 60_000;

// Camera (M2-07; FR-CAP-01; design: Camera). Until the editor lands (M2-11) the shutter queues the
// photo and returns to Today; the gallery picker and the denied screen are M2-08.
export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const reduceMotion = useReduceMotion();
  const params = useLocalSearchParams<{ slot?: string }>();
  const access = useCameraAccess();

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
  const { userId, localDate, jar, queue } = useToday(now);
  const nowSlot = currentSlot(now, tz);
  const taken = new Set<Slot>(
    buildTodayGrid({ localDate: jar?.jar?.localDate ?? localDate, moments: jar?.moments ?? [], queue, nowSlot })
      .filter((tile) => tile.state !== 'empty' && tile.state !== 'now')
      .map((tile) => tile.slot),
  );
  const [picked, setPicked] = useState<Slot | null>(null);
  const slot = picked ?? defaultCameraSlot({ param: parseSlotParam(params.slot), nowSlot, taken });

  const [facing, setFacing] = useState<CameraFacing>('back');
  const [flash, setFlash] = useState<FlashSetting>('off');
  const [flashSupported, setFlashSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const camera = useRef<CameraHandle>(null);

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
    // Leave first: preparing and queueing run behind Today, which re-reads the queue once it's saved.
    leave();
    const openJar = jar?.jar ?? null;
    saveCapture({ uri, slot, userId, tz, shotAt, openJar })
      .then(() => queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) }))
      .catch((error: unknown) => captureError(error, { area: 'capture' }));
  };

  if (access === 'denied') return <CameraAccessOff onClose={leave} insets={insets} />;

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
      taken={taken}
      time={formatTime(now, tz)}
      flash={flash}
      flashSupported={access === 'mock' || flashSupported}
      shutterDisabled={busy || userId === null || (access !== 'mock' && access !== 'granted')}
      reduceMotion={reduceMotion}
      insets={insets}
      onClose={leave}
      onToggleFlash={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
      onFlip={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
      // TODO(M2-08): open the gallery picker (then Crop for non-3:4 photos).
      onGallery={() => undefined}
      onShutter={() => void onShutter()}
      onSelectSlot={(next) => setPicked(switchSlot(slot, next, taken))}
    />
  );
}

function requireCamera(handle: CameraHandle | null): CameraHandle {
  if (!handle) throw new Error('Camera is not ready');
  return handle;
}
