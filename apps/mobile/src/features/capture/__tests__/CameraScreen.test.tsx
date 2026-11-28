// Gesture-handler's own jest mocks for its native module (tap to focus and pinch to zoom).
import 'react-native-gesture-handler/jestSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import '../../edit/__tests__/mockReanimated';
import type { ReactNode } from 'react';
import { AccessibilityInfo, AppState, Linking, Pressable, Text, View, type AppStateStatus } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import CameraScreen from '../../../../app/camera';
import { parseDevPhotoParam, parseMockAccessParam, pickDevPhoto, takeMockPhoto } from '../mockCamera';
import { usePendingCrop } from '../pendingCrop';
import { libraryAccess, libraryPhotoFile, loadLibraryPhotos } from '../libraryPhotos';
import { pickFromGallery } from '../pickFromGallery';
import { saveCapture, saveGalleryPhoto } from '../saveCapture';
import { captureError } from '@/lib/monitoring';
import { sizes, space } from '@/theme/tokens';
import type { QueuedMoment } from '@/features/jar/todayGrid';

// Camera screen wiring (FR-CAP-01, FR-CAP-11): permission branch and Camera access off, dev mock camera,
// the moment pill and its picker (D-151), flash and flip, the shutter path, and zoom and tap to focus (D-144). vision-camera's
// native module and the save path are mocked; its permission hook is the real one (it re-reads the status when
// the app becomes active). saveCapture has its own test; the zoom rules have cameraZoom.test.

// A camera device as vision-camera reports it, with just what the screen reads.
type MockDevice = {
  id: string;
  hasFlash: boolean;
  type: string;
  physicalDevices: { type: string }[];
  minZoom: number;
  maxZoom: number;
  zoomLensSwitchFactors: number[];
  supportsFocusMetering: boolean;
};
// An iPhone 14 Pro: the back is one virtual camera over three lenses (zoom 1 = ultra-wide, 2 = wide, 6 = the
// 3× telephoto); the front is a single lens that can't focus on a point.
const triple: MockDevice = {
  id: 'back',
  hasFlash: true,
  type: 'triple',
  physicalDevices: [{ type: 'ultra-wide-angle' }, { type: 'wide-angle' }, { type: 'telephoto' }],
  minZoom: 1,
  maxZoom: 123,
  zoomLensSwitchFactors: [2, 6],
  supportsFocusMetering: true,
};
const frontLens: MockDevice = {
  id: 'front',
  hasFlash: false,
  type: 'wide-angle',
  physicalDevices: [],
  minZoom: 1,
  maxZoom: 16,
  zoomLensSwitchFactors: [],
  supportsFocusMetering: false,
};
// A phone with only a wide lens on the back.
const singleBack: MockDevice = { ...frontLens, id: 'back-wide', hasFlash: true, supportsFocusMetering: true };

const mockCamera = {
  isDevice: false,
  permission: 'authorized' as 'authorized' | 'not-determined' | 'denied',
  capturePhotoToFile: jest.fn(async (..._args: unknown[]) => ({ filePath: '/tmp/vc-shot.jpg' })),
  requestPermission: jest.fn(async () => true),
  // The same object for every render, as vision-camera's hook returns.
  devices: { back: triple, front: frontLens } as Record<string, MockDevice>,
  focusTo: jest.fn(async (..._args: unknown[]) => {}),
  setZoom: jest.fn(async (..._args: unknown[]) => {}),
};

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockCamera.isDevice;
  },
}));

jest.mock('react-native-vision-camera/lib/VisionCamera', () => ({
  VisionCamera: {
    get cameraPermissionStatus() {
      return mockCamera.permission;
    },
    requestCameraPermission: () => mockCamera.requestPermission(),
  },
}));

jest.mock('react-native-vision-camera', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const { useCameraPermission: realUseCameraPermission } = jest.requireActual<
    typeof import('react-native-vision-camera/lib/hooks/usePermission')
  >('react-native-vision-camera/lib/hooks/usePermission');
  const photoOutput = { capturePhotoToFile: (...args: unknown[]) => mockCamera.capturePhotoToFile(...args) };
  return {
    Camera: ({ ref, ...props }: { isActive: boolean; ref?: import('react').Ref<unknown> }) => {
      useImperativeHandle(ref, () => ({
        focusTo: (...args: unknown[]) => mockCamera.focusTo(...args),
        controller: { setZoom: (...args: unknown[]) => mockCamera.setZoom(...args) },
      }));
      return <MockView testID="camera-live-preview" {...props} />;
    },
    CommonResolutions: { FHD_4_3: { width: 1440, height: 1920 } },
    useCameraDevice: jest.fn((position: string, _filter?: unknown) => mockCamera.devices[position]),
    usePhotoOutput: () => photoOutput,
    useCameraPermission: jest.fn(() => realUseCameraPermission()),
    VisionCamera: { createDeviceFactory: async () => ({ cameraDevices: [{ id: 'back' }] }) },
  };
});

jest.mock('../mockCamera', () => ({
  ...jest.requireActual<typeof import('../mockCamera')>('../mockCamera'),
  takeMockPhoto: jest.fn(async () => 'file:///cache/mock-camera.jpg'),
  pickDevPhoto: jest.fn(async (name: string) => ({
    uri: `file:///cache/dev-${name}.jpg`,
    width: name === 'portrait' ? 480 : 600,
    height: name === 'portrait' ? 640 : 400,
    exif: null,
  })),
}));

jest.mock('../saveCapture', () => ({
  ...jest.requireActual<typeof import('../saveCapture')>('../saveCapture'),
  saveCapture: jest.fn(),
  saveGalleryPhoto: jest.fn(),
}));
jest.mock('../pickFromGallery', () => ({ pickFromGallery: jest.fn() }));
// The in-app grid's library (iOS with Photos access); no access by default, so the system picker opens.
jest.mock('../libraryPhotos', () => ({
  libraryAccess: jest.fn(),
  loadLibraryPhotos: jest.fn(),
  libraryPhotoFile: jest.fn(),
  onLibraryChange: () => () => {},
  chooseMorePhotos: jest.fn(),
}));
const mockMirror = { on: true };
jest.mock('../cameraPrefs', () => ({ getMirrorSelfies: async () => mockMirror.on }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
// The moment picker is the kit sheet; gorhom's sheet renders its content straight away here, and closing it
// reports back as a real sheet does.
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet/mock');
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const Sheet = forwardRef<{ close: () => void }, { onClose: () => void; children: ReactNode }>(
    function Sheet(props, ref) {
      useImperativeHandle(ref, () => ({ close: () => props.onClose() }));
      return <>{props.children}</>;
    },
  );
  return {
    ...actual,
    __esModule: true,
    default: Sheet,
    BottomSheetView: ({ children }: { children: ReactNode }) => children,
    BottomSheetScrollView: ({ children }: { children: ReactNode }) => children,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: object) => config,
  };
});
// The Replace dialog (kit Dialog) reads Reduce Motion from Reanimated. expo-router's testing library mocks
// Reanimated with `react-native-reanimated/mock`, which can't load here; give it the hook it needs, and the
// two functions the gallery grid's gesture detector looks for.
jest.mock('react-native-reanimated/mock', () => ({
  __esModule: true,
  default: { createAnimatedComponent: <T,>(component: T) => component },
  isSharedValue: () => false,
  useReducedMotion: () => false,
}));

const userId = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
const mockToday = {
  userId: userId as string | null,
  jar: { id: 'jar-1', localDate: '2026-11-11', tz: 'Asia/Manila' },
  queue: [] as QueuedMoment[],
};

jest.mock('@/features/jar/useToday', () => ({
  phoneTimeZone: () => 'Asia/Manila',
  todayQueryKeys: { queue: (id: string) => ['queue', id] },
  useToday: () => ({
    userId: mockToday.userId,
    localDate: mockToday.jar.localDate,
    todayDate: mockToday.jar.localDate,
    jarPending: false,
    jar: { hasAnyJar: true, jar: mockToday.jar, moments: [] },
    queue: mockToday.queue,
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => (
    <View>
      <Text>Today stub</Text>
    </View>
  ),
  camera: CameraScreen,
  // A past day's page (D-153), where `/camera?date=<past>` sends you instead.
  'day/[date]': function DayStub() {
    const { date } = useLocalSearchParams<{ date: string }>();
    return (
      <View>
        <Text>Day stub {String(date)}</Text>
      </View>
    );
  },
  // The Crop screen has its own test; this stub shows which photo it was handed.
  crop: function CropStub() {
    const pending = usePendingCrop((s) => s.pending);
    return (
      <View>
        <Text>Crop stub {pending?.photo.uri}</Text>
      </View>
    );
  },
  // The editor (M2-12) has its own test; this stub shows which queued photo it opened on.
  'edit/[momentId]': function EditStub() {
    const { momentId } = useLocalSearchParams<{ momentId: string }>();
    return (
      <View>
        <Text>Editor stub {String(momentId)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave editor" onPress={() => router.back()} />
      </View>
    );
  },
};

// Every AppState listener (the permission hook's and the screen's), so a test can bring the app back.
const appStateListeners = new Set<(state: AppStateStatus) => void>();
async function setAppState(state: AppStateStatus) {
  await act(async () => appStateListeners.forEach((listener) => listener(state)));
}

async function openCamera(url: Href = '/camera?slot=afternoon', path = '/camera') {
  await renderRouter(routes, { initialUrl: '/today', wrapper });
  await act(async () => {
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    router.push(url);
  });
  expect(screen).toHavePathname(path);
}

const tagText = () => screen.getByTestId('camera-slot-tag').props.accessibilityLabel as string;

// The fixture's open jar is Nov 11 in Manila: pin the clock to that afternoon so the jar stays open whatever
// day the suite runs. Only Date is faked; timers stay real.
const NOW = new Date('2026-11-11T14:00:00+08:00');
const REAL_TIMERS = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

afterEach(() => jest.useRealTimers());

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: [...REAL_TIMERS] });
  mockCamera.isDevice = false;
  mockCamera.permission = 'authorized';
  mockCamera.capturePhotoToFile.mockClear();
  mockCamera.requestPermission.mockClear();
  mockCamera.devices = { back: triple, front: frontLens };
  mockCamera.focusTo.mockClear();
  mockCamera.setZoom.mockClear();
  jest.mocked(useCameraDevice).mockClear();
  jest.mocked(useCameraPermission).mockClear();
  jest.mocked(takeMockPhoto).mockClear();
  jest.mocked(saveCapture).mockReset();
  jest.mocked(pickFromGallery).mockReset();
  jest.mocked(pickFromGallery).mockResolvedValue(null);
  jest.mocked(pickDevPhoto).mockClear();
  jest.mocked(libraryAccess).mockReset();
  jest.mocked(libraryAccess).mockResolvedValue(null);
  jest.mocked(saveGalleryPhoto).mockReset();
  jest
    .mocked(saveGalleryPhoto)
    .mockImplementation(async () => ({ id: 4 }) as Awaited<ReturnType<typeof saveGalleryPhoto>>);
  usePendingCrop.setState({ pending: null });
  jest.mocked(captureError).mockClear();
  appStateListeners.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    const cb = listener as (state: AppStateStatus) => void;
    appStateListeners.add(cb);
    return { remove: () => appStateListeners.delete(cb) } as ReturnType<typeof AppState.addEventListener>;
  });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  jest.mocked(saveCapture).mockImplementation(async () => ({ id: 1 }) as Awaited<ReturnType<typeof saveCapture>>);
  mockToday.userId = userId;
  mockToday.queue = [];
});

describe('Camera on the Simulator (dev mock camera)', () => {
  it('shows the mock preview with grid, slot tag and 3:4 frame, and never asks for permission', async () => {
    mockCamera.permission = 'not-determined';
    await openCamera();
    expect(screen.getByTestId('camera-mock-preview')).toBeTruthy();
    expect(screen.queryByTestId('camera-live-preview')).toBeNull();
    expect(screen.getByTestId('viewfinder-grid', { includeHiddenElements: true })).toBeTruthy();
    expect(tagText()).toMatch(/^#afternoon, today at /);
    expect(screen.getByText('3:4', { includeHiddenElements: true })).toBeTruthy();
    expect(mockCamera.requestPermission).not.toHaveBeenCalled();
  });

  it('the 3:4 label sits in the bottom-left corner, out of the zoom row, and never takes a tap (D-145)', async () => {
    await openCamera();
    const aspect = screen.getByTestId('camera-aspect', { includeHiddenElements: true });
    expect(within(aspect).getByText('3:4', { includeHiddenElements: true })).toBeTruthy();
    // Level with the zoom buttons and as far in as Close.
    expect(aspect).toHaveStyle({ position: 'absolute', left: space.lg, bottom: space.md, height: sizes.zoomButton });
    // A label, not a control: taps reach tap to focus, and screen readers skip it.
    expect(aspect.props.pointerEvents).toBe('none');
    expect(screen.queryByTestId('camera-aspect')).toBeNull();
    // The zoom row's stack holds only the zoom controls now.
    const buttons = screen.getByTestId('camera-zoom-buttons');
    expect(within(buttons).queryByText('3:4', { includeHiddenElements: true })).toBeNull();
    expect(within(aspect).queryAllByRole('button', { includeHiddenElements: true })).toEqual([]);
  });

  it('stays on the camera until the photo is in the queue, so a kill right after the shutter loses nothing', async () => {
    let finish: () => void = () => undefined;
    jest.mocked(saveCapture).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ id: 1 } as Awaited<ReturnType<typeof saveCapture>>);
        }),
    );
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(saveCapture).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/camera');

    await act(async () => finish());
    expect(screen).toHavePathname('/edit/1');
  });

  it('opens on the tile’s slot, and the shutter queues the mock photo there and returns', async () => {
    await openCamera('/camera?slot=selfie');
    expect(tagText()).toMatch(/^#selfie,/);
    expect(screen.queryByRole('tab')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});

    // #selfie opens on the front lens (D-99).
    expect(takeMockPhoto).toHaveBeenCalledWith('front');
    // The editor opens on the queued photo once it is in the queue (preparing runs behind it).
    expect(screen).toHavePathname('/edit/1');
    expect(saveCapture).toHaveBeenCalledTimes(1);
    expect(saveCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'file:///cache/mock-camera.jpg',
        slot: 'selfie',
        userId,
        tz: 'Asia/Manila',
        openJar: mockToday.jar,
        shotAt: expect.any(Date),
      }),
    );
  });

  it('cancelling the gallery picker does nothing', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(pickFromGallery).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/camera');
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
    expect(usePendingCrop.getState().pending).toBeNull();
    expect(captureError).not.toHaveBeenCalled();
  });

  it('a gallery photo that is not 3:4 opens Crop with the slot and its own date; nothing is queued yet', async () => {
    jest.mocked(pickFromGallery).mockResolvedValue({
      uri: 'file:///picker/beach.jpg',
      width: 4032,
      height: 3024,
      exif: { DateTimeOriginal: '2026:11:08 19:30:00', OffsetTimeOriginal: '+08:00' },
    });
    await openCamera('/camera?slot=selfie');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(screen).toHavePathname('/crop');
    expect(screen.getByText('Crop stub file:///picker/beach.jpg')).toBeTruthy();
    expect(usePendingCrop.getState().pending).toEqual({
      photo: expect.objectContaining({ uri: 'file:///picker/beach.jpg', width: 4032, height: 3024 }),
      slot: 'selfie',
      userId,
      target: { localDate: '2026-11-08', tz: 'Asia/Manila', capturedAt: '2026-11-08T19:30:00+08:00' },
    });
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
  });

  it('an exactly 3:4 gallery photo skips Crop: queued like a shot, then the editor opens', async () => {
    jest.mocked(pickFromGallery).mockResolvedValue({
      uri: 'file:///picker/portrait.jpg',
      width: 3024,
      height: 4032,
      exif: null,
    });
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(saveGalleryPhoto).toHaveBeenCalledWith({
      uri: 'file:///picker/portrait.jpg',
      slot: 'afternoon',
      userId,
      target: expect.objectContaining({ localDate: '2026-11-11', tz: 'Asia/Manila' }),
      crop: null,
      visibility: null,
      exif: null,
    });
    expect(screen).toHavePathname('/edit/4');
    expect(saveCapture).not.toHaveBeenCalled();
  });

  it('a picker or queue failure is reported and the camera stays', async () => {
    jest.mocked(pickFromGallery).mockRejectedValue(new Error('picker broke'));
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'picker broke' }), {
      area: 'gallery',
    });
    expect(screen).toHavePathname('/camera');
  });

  it('dev-only ?devPhoto= picks a bundled photo instead of the system picker', async () => {
    await openCamera('/camera?slot=afternoon&devPhoto=wide');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(pickDevPhoto).toHaveBeenCalledWith('wide');
    expect(pickFromGallery).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/crop');
  });

  it('parseDevPhotoParam accepts only the bundled names, and only in development', () => {
    expect(parseDevPhotoParam('wide', true)).toBe('wide');
    expect(parseDevPhotoParam('portrait', true)).toBe('portrait');
    expect(parseDevPhotoParam('wide', false)).toBeNull();
    expect(parseDevPhotoParam('toString', true)).toBeNull();
    expect(parseDevPhotoParam('../etc', true)).toBeNull();
    expect(parseDevPhotoParam(['wide'], true)).toBeNull();
  });

  it('#selfie starts on the front lens and flip still goes back to the rear one (D-99)', async () => {
    await openCamera('/camera?slot=selfie');
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(takeMockPhoto).toHaveBeenCalledWith('back');
  });

  it('flip takes the front fixture', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(takeMockPhoto).toHaveBeenCalledWith('front');
  });

  describe('Mirror selfies (D-66)', () => {
    afterEach(() => {
      mockMirror.on = true;
    });

    it.each<[string, boolean, boolean, boolean]>([
      ['front, switch on (default): kept as previewed', true, true, false],
      ['front, switch off: flipped back', true, false, true],
      ['back, switch off: never flipped', false, false, false],
    ])('%s', async (_name, front, on, flipped) => {
      mockMirror.on = on;
      await openCamera();
      if (front) await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
      await act(async () => {});
      expect(saveCapture).toHaveBeenCalledWith(expect.objectContaining({ flip: flipped }));
    });
  });

  it('without a slot (the hidden Capture route) it opens on the Now slot, else the first empty slot', async () => {
    await openCamera('/camera');
    expect(tagText()).toMatch(/^#afternoon,/);

    const queued = (slot: QueuedMoment['slot'], id: number): QueuedMoment => ({
      id,
      slot,
      state: 'queued',
      localDate: '2026-11-11',
      photoUri: `file:///q/${id}.webp`,
      thumbUri: null,
      capturedAt: null,
      visibility: 'readers',
    });
    mockToday.queue = [queued('afternoon', 1), queued('whereami', 2)];
    await openCamera('/camera');
    expect(tagText()).toMatch(/^#mebusywith,/);
  });

  describe('a filled slot asks to Replace first (M2-22)', () => {
    const filled = (slot: QueuedMoment['slot']): QueuedMoment => ({
      id: 1,
      slot,
      state: 'queued',
      localDate: '2026-11-11',
      photoUri: 'file:///q/1.webp',
      thumbUri: null,
      capturedAt: null,
      visibility: 'readers',
    });

    it('Replace takes the photo and queues it as a replacement', async () => {
      mockToday.queue = [filled('afternoon')];
      await openCamera('/camera?slot=afternoon');
      await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
      expect(screen.getByRole('header', { name: 'Replace your #afternoon photo?' })).toBeTruthy();
      expect(takeMockPhoto).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
      await act(async () => {});
      expect(saveCapture).toHaveBeenCalledWith(expect.objectContaining({ slot: 'afternoon', replace: true }));
      expect(screen).toHavePathname('/edit/1');
    });

    it('Cancel takes no photo and stays on the camera', async () => {
      mockToday.queue = [filled('afternoon')];
      await openCamera('/camera?slot=afternoon');
      await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
      await act(async () => {});
      expect(takeMockPhoto).not.toHaveBeenCalled();
      expect(saveCapture).not.toHaveBeenCalled();
      expect(screen.queryByRole('header', { name: 'Replace your #afternoon photo?' })).toBeNull();
      expect(screen).toHavePathname('/camera');
    });

    it('an empty slot never asks and is not a replacement', async () => {
      mockToday.queue = [filled('selfie')];
      await openCamera('/camera?slot=afternoon');
      await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
      await act(async () => {});
      expect(screen.queryByRole('header')).toBeNull();
      expect(saveCapture).toHaveBeenCalledWith(expect.objectContaining({ slot: 'afternoon', replace: false }));
    });
  });

  it('ignores a slot param that is not a slot', async () => {
    await openCamera('/camera?slot=brunch');
    expect(tagText()).not.toMatch(/brunch/);
  });

  it('the editor takes the camera’s place, so leaving it lands on Today, not back on the camera', async () => {
    jest.mocked(saveCapture).mockImplementation(async () => ({ id: 42 }) as Awaited<ReturnType<typeof saveCapture>>);
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(screen).toHavePathname('/edit/42');
    expect(screen.getByText('Editor stub 42')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave editor' }));
    expect(screen).toHavePathname('/today');
  });

  it('when the photo could not be queued, there is nothing to edit: back to Today', async () => {
    jest.mocked(saveCapture).mockRejectedValue(new Error('disk full'));
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'capture' });
    expect(screen).toHavePathname('/today');
  });

  it('opened by a deep link, the shutter still opens the editor', async () => {
    await renderRouter(routes, { initialUrl: '/camera?slot=ootd', wrapper });
    expect(tagText()).toMatch(/^#ootd,/);
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(screen).toHavePathname('/edit/1');
  });

  it('Close goes back without capturing', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/today');
    expect(takeMockPhoto).not.toHaveBeenCalled();
    expect(saveCapture).not.toHaveBeenCalled();
  });

  it('signed out, the shutter is disabled', async () => {
    mockToday.userId = null;
    await openCamera();
    const shutter = screen.getByRole('button', { name: 'Take photo' });
    expect(shutter.props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('Camera on a phone', () => {
  beforeEach(() => {
    mockCamera.isDevice = true;
  });

  it('asks for camera permission on first open', async () => {
    mockCamera.permission = 'not-determined';
    await openCamera();
    expect(mockCamera.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('camera-live-preview')).toBeNull();
    expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState).toEqual({ disabled: true });
  });

  it('shows the live 3:4 camera and captures with the chosen flash', async () => {
    await openCamera();
    expect(screen.getByTestId('camera-live-preview').props.isActive).toBe(true);
    expect(screen.queryByTestId('camera-mock-preview')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Flash off' }));
    expect(screen.getByRole('button', { name: 'Flash on' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});

    expect(mockCamera.capturePhotoToFile).toHaveBeenCalledWith({ flashMode: 'on' }, {});
    expect(saveCapture).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///tmp/vc-shot.jpg', slot: 'afternoon' }),
    );
    expect(screen).toHavePathname('/edit/1');
  });

  it('flip switches to the front lens, whose missing flash disables the flash button', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    expect(jest.mocked(useCameraDevice)).toHaveBeenLastCalledWith('front', undefined);
    expect(screen.getByRole('button', { name: 'Flash off' }).props.accessibilityState).toEqual({ disabled: true });
  });

  it('#selfie opens on the front lens (D-99)', async () => {
    await openCamera('/camera?slot=selfie');
    expect(jest.mocked(useCameraDevice)).toHaveBeenLastCalledWith('front', undefined);
  });

  it('a failed capture stays on the camera with the shutter enabled again', async () => {
    mockCamera.capturePhotoToFile.mockRejectedValueOnce(new Error('session interrupted'));
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(screen).toHavePathname('/camera');
    expect(saveCapture).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState).toEqual({ disabled: false });
  });
});

describe('Zoom and tap to focus (D-144)', () => {
  beforeEach(() => {
    mockCamera.isDevice = true;
  });

  const zoomButton = (factor: string) => screen.getByRole('button', { name: `Zoom ${factor} times` });
  const zoomLabels = () =>
    screen.queryAllByRole('button', { name: /^Zoom .* times$/ }).map((b) => b.props.accessibilityLabel as string);
  const selectedZoom = () =>
    screen
      .queryAllByRole('button', { name: /^Zoom .* times$/ })
      .filter((b) => b.props.accessibilityState?.selected)
      .map((b) => b.props.accessibilityLabel as string);
  // The zoom shown while pinching.
  const readout = () => screen.getByTestId('camera-zoom-readout', { includeHiddenElements: true });
  const cameraZoom = () => screen.getByTestId('camera-live-preview').props.zoom as number;
  const layOut = async () =>
    act(() => {
      fireEvent(screen.getByTestId('camera-touch-area'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 520 } },
      });
    });
  const tapAt = async (x: number, y: number) => {
    const tap = createGestureController('camera-tap');
    await act(() => {
      tap.begin({ x, y, absoluteX: x, absoluteY: y });
      tap.activate({ x, y, absoluteX: x, absoluteY: y });
      tap.end({ x, y, absoluteX: x, absoluteY: y });
    });
  };
  const pinchTo = async (...scales: number[]) => {
    const pinch = createGestureController('camera-pinch');
    // The pinch runs as a worklet; its steps reach React a microtask later (expo-router's worklets mock).
    await act(() => {
      pinch.begin({ focalX: 100, focalY: 100, scale: 1 });
      pinch.activate({ focalX: 100, focalY: 100, scale: 1 });
      for (const scale of scales) pinch.update({ focalX: 100, focalY: 100, scale });
      // The suite's fake clock holds microtasks; let the pinch steps through.
      jest.runAllTicks();
    });
    return async () => {
      const last = scales[scales.length - 1];
      await act(() => {
        pinch.end({ focalX: 100, focalY: 100, scale: last });
        jest.runAllTicks();
      });
    };
  };

  it('opens the back camera over all its lenses, at 1× (the wide lens), with a button per lens', async () => {
    await openCamera();
    expect(jest.mocked(useCameraDevice)).toHaveBeenLastCalledWith('back', {
      physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
    });
    expect(zoomLabels()).toEqual(['Zoom 0.5 times', 'Zoom 1 times', 'Zoom 2 times', 'Zoom 3 times']);
    expect(screen.getByText('0.5×')).toBeTruthy();
    expect(screen.getByText('3×')).toBeTruthy();
    expect(selectedZoom()).toEqual(['Zoom 1 times']);
    // The wide lens sits at zoom 2 on the triple camera (1 is the ultra-wide).
    expect(cameraZoom()).toBe(2);
  });

  it.each([
    ['0.5', 1],
    ['2', 4],
    ['3', 6],
    ['1', 2],
  ])('the %s× button sets zoom %d and is shown selected', async (factor, zoom) => {
    await openCamera();
    await fireEvent.press(zoomButton(factor));
    expect(cameraZoom()).toBe(zoom);
    expect(selectedZoom()).toEqual([`Zoom ${factor} times`]);
  });

  it('pinching zooms the camera live, shows the zoom, and keeps it when the fingers lift', async () => {
    await openCamera();
    const end = await pinchTo(1.5);
    // From 1× (zoom 2) by 1.5: zoom 3, read as 1.5×.
    expect(mockCamera.setZoom).toHaveBeenLastCalledWith(3);
    expect(readout()).toHaveTextContent('1.5×', { exact: true });
    expect(selectedZoom()).toEqual(['Zoom 1 times']);
    await end();
    expect(screen.queryByTestId('camera-zoom-readout', { includeHiddenElements: true })).toBeNull();
    expect(cameraZoom()).toBe(3);
  });

  it('pinch stops at 10× (zoom 20) and at the ultra-wide (zoom 1)', async () => {
    await openCamera();
    const end = await pinchTo(100);
    expect(mockCamera.setZoom).toHaveBeenLastCalledWith(20);
    expect(readout()).toHaveTextContent('10×', { exact: true });
    expect(selectedZoom()).toEqual(['Zoom 3 times']);
    await end();
    expect(cameraZoom()).toBe(20);

    const endOut = await pinchTo(0.01);
    expect(mockCamera.setZoom).toHaveBeenLastCalledWith(1);
    expect(readout()).toHaveTextContent('0.5×', { exact: true });
    await endOut();
    expect(cameraZoom()).toBe(1);
    expect(selectedZoom()).toEqual(['Zoom 0.5 times']);
  });

  it('tapping the preview focuses there and draws the focus square around the tap, inside the frame', async () => {
    await openCamera();
    await layOut();
    await tapAt(100, 200);
    expect(mockCamera.focusTo).toHaveBeenLastCalledWith({ x: 100, y: 200 });
    // 72 pt square centred on the tap.
    expect(screen.getByTestId('camera-focus-mark', { includeHiddenElements: true })).toHaveStyle({
      left: 64,
      top: 164,
    });
    // Near the bottom-left corner: focus on the tap, the square stays inside the 390 × 520 preview.
    await tapAt(5, 510);
    expect(mockCamera.focusTo).toHaveBeenLastCalledWith({ x: 5, y: 510 });
    expect(screen.getByTestId('camera-focus-mark', { includeHiddenElements: true })).toHaveStyle({
      left: 0,
      top: 448,
    });
  });

  it('flip to the front lens: no zoom buttons, no tap to focus, zoom at 1×; flipping back starts at 1× again', async () => {
    await openCamera();
    await fireEvent.press(zoomButton('3'));
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    expect(zoomLabels()).toEqual([]);
    expect(cameraZoom()).toBe(1);
    await layOut();
    await tapAt(100, 200);
    expect(mockCamera.focusTo).not.toHaveBeenCalled();
    expect(screen.queryByTestId('camera-focus-mark', { includeHiddenElements: true })).toBeNull();
    // Pinch still zooms the front lens.
    const end = await pinchTo(2);
    expect(mockCamera.setZoom).toHaveBeenLastCalledWith(2);
    await end();

    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    expect(selectedZoom()).toEqual(['Zoom 1 times']);
    expect(cameraZoom()).toBe(2);
  });

  it('a phone with one back lens shows no zoom buttons but still pinches and focuses', async () => {
    mockCamera.devices = { back: singleBack, front: frontLens };
    await openCamera();
    expect(zoomLabels()).toEqual([]);
    expect(cameraZoom()).toBe(1);
    const end = await pinchTo(3);
    expect(mockCamera.setZoom).toHaveBeenLastCalledWith(3);
    expect(readout()).toHaveTextContent('3×', { exact: true });
    await end();
    await layOut();
    await tapAt(50, 60);
    expect(mockCamera.focusTo).toHaveBeenLastCalledWith({ x: 50, y: 60 });
  });

  it('on the Simulator the mock camera has an iPhone 14 Pro’s buttons, and zooming enlarges its photo', async () => {
    mockCamera.isDevice = false;
    await openCamera();
    expect(zoomLabels()).toEqual(['Zoom 0.5 times', 'Zoom 1 times', 'Zoom 2 times', 'Zoom 3 times']);
    await fireEvent.press(zoomButton('2'));
    expect(screen.getByTestId('camera-mock-preview')).toHaveStyle({ transform: [{ scale: 2 }] });
    // A flip there and back starts at 1× again, as on a phone.
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    expect(selectedZoom()).toEqual(['Zoom 1 times']);
    expect(screen.getByTestId('camera-mock-preview')).toHaveStyle({ transform: [{ scale: 1 }] });
  });
});

describe('Camera access off (FR-CAP-11)', () => {
  beforeEach(() => {
    mockCamera.isDevice = true;
    mockCamera.permission = 'denied';
  });

  it('denied permission shows Camera access off instead of the camera, without asking again', async () => {
    await openCamera();
    expect(screen.getByRole('header', { name: 'Pickld can’t use your camera' })).toBeTruthy();
    expect(screen.getByText(/Turn it on in your phone’s settings/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose from gallery instead' })).toBeTruthy();
    expect(screen.queryByTestId('camera-screen')).toBeNull();
    expect(screen.queryByTestId('camera-live-preview')).toBeNull();
    expect(mockCamera.requestPermission).not.toHaveBeenCalled();
  });

  it('restricted access (parental controls) also shows it', async () => {
    mockCamera.permission = 'restricted' as typeof mockCamera.permission;
    await openCamera();
    expect(screen.getByTestId('camera-access-off')).toBeTruthy();
  });

  it('Open Settings opens the app’s page in Settings and stays here', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/camera');
  });

  it('coming back from Settings with access on shows the live camera', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    await setAppState('background');
    mockCamera.permission = 'authorized';
    await setAppState('active');
    expect(screen.queryByTestId('camera-access-off')).toBeNull();
    expect(screen.getByTestId('camera-live-preview').props.isActive).toBe(true);
    expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState).toEqual({ disabled: false });
  });

  it('coming back with access still off keeps the screen', async () => {
    await openCamera();
    await setAppState('active');
    expect(screen.getByTestId('camera-access-off')).toBeTruthy();
  });

  it('Close goes back to Today without capturing', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/today');
    expect(saveCapture).not.toHaveBeenCalled();
  });

  it('Close from a deep link also lands on Today', async () => {
    await renderRouter(routes, { initialUrl: '/camera', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/today');
  });

  it('Choose from gallery instead opens the picker; cancel stays on Camera access off', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery instead' }));
    await act(async () => {});
    expect(pickFromGallery).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/camera');
    expect(screen.getByTestId('camera-access-off')).toBeTruthy();
  });

  it('Choose from gallery instead sends a landscape photo to Crop', async () => {
    jest
      .mocked(pickFromGallery)
      .mockResolvedValue({ uri: 'file:///picker/l.jpg', width: 400, height: 300, exif: null });
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery instead' }));
    await act(async () => {});
    expect(screen).toHavePathname('/crop');
  });

  it('dev-only ?mockAccess=denied forces it even on the Simulator mock camera', async () => {
    mockCamera.isDevice = false;
    mockCamera.permission = 'authorized';
    await openCamera('/camera?mockAccess=denied');
    expect(screen.getByTestId('camera-access-off')).toBeTruthy();
    expect(screen.queryByTestId('camera-mock-preview')).toBeNull();
  });

  it('release builds ignore ?mockAccess, and only "denied" is honoured', () => {
    expect(parseMockAccessParam('denied', true)).toBe('denied');
    expect(parseMockAccessParam('denied', false)).toBeNull();
    expect(parseMockAccessParam('granted', true)).toBeNull();
    expect(parseMockAccessParam(['denied'], true)).toBeNull();
    expect(parseMockAccessParam(undefined, true)).toBeNull();
  });
});

// D-153: a past day is filled from its page's gallery, never the camera.
describe('the camera on a date (?date=, FR-DAY-02)', () => {
  it('a past date opens that day’s page instead and captures nothing', async () => {
    await openCamera('/camera?date=2026-11-08&slot=selfie', '/day/2026-11-08');
    expect(screen.getByText('Day stub 2026-11-08')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
    expect(saveCapture).not.toHaveBeenCalled();
  });

  it.each([
    ['today', '2026-11-11'],
    ['a future date', '2026-11-12'],
    ['a malformed date', '2026-11-8'],
  ])('%s is a normal capture into the open jar', async (_name, date) => {
    await openCamera(`/camera?date=${date}&slot=afternoon`);
    expect(tagText()).toMatch(/^#afternoon, today at /);
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(saveCapture).toHaveBeenCalledWith(expect.objectContaining({ openJar: mockToday.jar }));
    expect(jest.mocked(saveCapture).mock.calls[0]?.[0]).not.toHaveProperty('fill');
  });
});

// With Photos access the camera's gallery button opens the in-app grid on all photos (no day to fill).
describe('the camera’s in-app gallery', () => {
  it('opens on all photos, and its photo goes to Crop full size, for today’s jar', async () => {
    jest.mocked(libraryAccess).mockResolvedValue('all');
    jest
      .mocked(loadLibraryPhotos)
      .mockResolvedValue([
        { id: 'ph://a', width: 4032, height: 3024, creationTime: Date.parse('2026-11-11T09:00:00+08:00') },
      ]);
    jest.mocked(libraryPhotoFile).mockResolvedValue({
      uri: 'file:///cache/gallery-1.jpg',
      width: 4032,
      height: 3024,
      exif: { DateTimeOriginal: '2026:11:11 09:00:00', OffsetTimeOriginal: '+08:00' },
    });
    await openCamera('/camera?slot=selfie');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    expect(await screen.findByTestId('gallery-grid')).toBeTruthy();
    expect(screen.queryByTestId('gallery-shown')).toBeNull();
    expect(screen.getByTestId('gallery-close').props.accessibilityHint).toBe('Closes the gallery without a photo');
    await fireEvent.press(screen.getByTestId('gallery-photo-ph://a'));
    await waitFor(() => expect(screen).toHavePathname('/crop'));
    expect(usePendingCrop.getState().pending).toEqual(
      expect.objectContaining({ slot: 'selfie', target: expect.objectContaining({ localDate: '2026-11-11' }) }),
    );
  });

  it('closing the grid keeps the camera and queues nothing', async () => {
    jest.mocked(libraryAccess).mockResolvedValue('all');
    jest.mocked(loadLibraryPhotos).mockResolvedValue([]);
    await openCamera('/camera?slot=selfie');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await fireEvent.press(await screen.findByTestId('gallery-close'));
    await waitFor(() => expect(screen.queryByTestId('gallery-grid')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState).toEqual({ disabled: false }),
    );
    expect(screen).toHavePathname('/camera');
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
    expect(usePendingCrop.getState().pending).toBeNull();
  });
});

describe('Change the moment from the camera (D-151)', () => {
  const queued = (slot: QueuedMoment['slot'], localDate = '2026-11-11'): QueuedMoment => ({
    id: Math.floor(Math.random() * 1e6),
    slot,
    state: 'queued',
    localDate,
    photoUri: 'file:///q/x.webp',
    thumbUri: null,
    capturedAt: null,
    visibility: 'readers',
  });
  const pill = () => screen.getByTestId('camera-slot-tag');
  const row = (slot: string) => screen.getByTestId(`camera-slot-picker-${slot}`);
  const rowState = (slot: string) => row(slot).props.accessibilityState as { selected: boolean; disabled: boolean };
  const pickerHeader = () => screen.queryByRole('header', { name: 'Change the moment' });
  const lastLens = () => jest.mocked(useCameraDevice).mock.calls.at(-1)?.[0];
  const openPicker = async () => {
    await fireEvent.press(screen.getByRole('button', { name: /^#\w+, (today at|for) / }));
    expect(screen.getByRole('header', { name: 'Change the moment' })).toBeTruthy();
  };
  const pick = async (slot: string) => {
    await fireEvent.press(row(slot));
    await act(async () => {});
  };
  const shoot = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
  };

  it('the slot is a button that says it changes the moment, and opens the picker on the day’s 8 slots', async () => {
    await openCamera('/camera?slot=afternoon');
    expect(pill().props.accessibilityRole).toBe('button');
    expect(tagText()).toMatch(/^#afternoon, today at /);
    expect(pill().props.accessibilityHint).toBe('Changes the moment');
    expect(pill().props.accessibilityState?.disabled).toBeFalsy();
    // It looks like a control: the slot with a chevron.
    expect(within(pill()).getByTestId('icon-chevronDown', { includeHiddenElements: true })).toBeTruthy();
    expect(pickerHeader()).toBeNull();

    await openPicker();
    expect(screen.getByText('For today’s jar')).toBeTruthy();
    const rows = screen.getAllByTestId(/^camera-slot-picker-[a-z]+$/).map((r) => r.props.accessibilityLabel as string);
    expect(rows).toEqual([
      '#whereami',
      '#mebusywith',
      '#whoamiwith',
      '#ootd',
      '#selfie',
      '#morning',
      '#afternoon',
      '#evening',
    ]);
    // Only the current slot is selected; nothing is taken yet, so every row can be picked.
    expect(rowState('afternoon')).toEqual({ selected: true, disabled: false });
    expect(screen.getByTestId('camera-slot-picker-afternoon-check')).toBeTruthy();
    expect(rowState('ootd')).toEqual({ selected: false, disabled: false });
    expect(row('ootd').props.accessibilityHint).toBe('Takes the photo for #ootd');
    expect(row('afternoon').props.accessibilityHint).toBeUndefined();
  });

  it('slots already in the jar are done and can’t be picked', async () => {
    mockToday.queue = [queued('whereami'), queued('ootd')];
    await openCamera('/camera?slot=afternoon');
    await openPicker();
    expect(row('whereami').props.accessibilityLabel).toBe('#whereami, done');
    expect(rowState('whereami')).toEqual({ selected: false, disabled: true });
    expect(rowState('ootd')).toEqual({ selected: false, disabled: true });
    expect(within(row('ootd')).getByText('Done')).toBeTruthy();
    expect(rowState('selfie')).toEqual({ selected: false, disabled: false });

    await pick('ootd');
    expect(tagText()).toMatch(/^#afternoon, /);
    expect(pickerHeader()).toBeTruthy();
  });

  it('picking a free slot switches the tag, the shutter hint and what the shutter saves, on the camera', async () => {
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    await openCamera('/camera?slot=afternoon');
    await openPicker();
    await pick('evening');
    expect(pickerHeader()).toBeNull();
    expect(screen).toHavePathname('/camera');
    expect(tagText()).toMatch(/^#evening, today at /);
    expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityHint).toBe(
      'Adds the photo to #evening',
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith('Now taking #evening');

    await shoot();
    expect(saveCapture).toHaveBeenCalledTimes(1);
    expect(saveCapture).toHaveBeenCalledWith(
      expect.objectContaining({ slot: 'evening', replace: false, openJar: mockToday.jar }),
    );
    expect(takeMockPhoto).toHaveBeenCalledWith('back');
  });

  it('a gallery photo after the switch goes to the new slot too', async () => {
    jest.mocked(pickFromGallery).mockResolvedValue({
      uri: 'file:///picker/portrait.jpg',
      width: 3024,
      height: 4032,
      exif: null,
    });
    await openCamera('/camera?slot=afternoon');
    await openPicker();
    await pick('whoamiwith');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(saveGalleryPhoto).toHaveBeenCalledWith(expect.objectContaining({ slot: 'whoamiwith' }));
  });

  it('opened on a filled slot to replace it, a switch to a free slot no longer asks to Replace', async () => {
    mockToday.queue = [queued('afternoon')];
    await openCamera('/camera?slot=afternoon');
    await openPicker();
    // The current slot stays selected and pressable, read as done.
    expect(row('afternoon').props.accessibilityLabel).toBe('#afternoon, done');
    expect(rowState('afternoon')).toEqual({ selected: true, disabled: false });
    await pick('morning');
    await shoot();
    expect(screen.queryByRole('header', { name: /Replace/ })).toBeNull();
    expect(saveCapture).toHaveBeenCalledWith(expect.objectContaining({ slot: 'morning', replace: false }));
  });

  it('switching to #selfie turns to the front camera; leaving it turns back to the rear one', async () => {
    await openCamera('/camera?slot=ootd');
    await openPicker();
    await pick('selfie');
    expect(tagText()).toMatch(/^#selfie, /);
    await shoot();
    expect(takeMockPhoto).toHaveBeenLastCalledWith('front');
    expect(saveCapture).toHaveBeenLastCalledWith(expect.objectContaining({ slot: 'selfie' }));
  });

  it('leaving the #selfie it opened on goes to the rear camera', async () => {
    await openCamera('/camera?slot=selfie');
    await openPicker();
    await pick('ootd');
    await shoot();
    expect(takeMockPhoto).toHaveBeenLastCalledWith('back');
    expect(saveCapture).toHaveBeenLastCalledWith(expect.objectContaining({ slot: 'ootd' }));
  });

  it('a lens the user flipped to by hand is kept when the moment changes', async () => {
    // Flipped twice on #selfie: the front lens is now the user's choice, so #ootd keeps it.
    await openCamera('/camera?slot=selfie');
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    await openPicker();
    await pick('ootd');
    await shoot();
    expect(takeMockPhoto).toHaveBeenLastCalledWith('front');
  });

  it('a change between two other slots keeps the lens', async () => {
    await openCamera('/camera?slot=ootd');
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    await openPicker();
    await pick('whereami');
    await shoot();
    expect(takeMockPhoto).toHaveBeenLastCalledWith('front');
  });

  it('on a phone, #selfie switches the live camera to the front lens and back', async () => {
    mockCamera.isDevice = true;
    await openCamera('/camera?slot=afternoon');
    expect(lastLens()).toBe('back');
    await openPicker();
    await pick('selfie');
    expect(lastLens()).toBe('front');
    await openPicker();
    await pick('evening');
    expect(lastLens()).toBe('back');
  });

  it('zoom goes back to 1× on a change of moment, as on a flip', async () => {
    mockCamera.isDevice = true;
    const zoomButton = (factor: string) => screen.getByRole('button', { name: `Zoom ${factor} times` });
    const selected = () =>
      screen
        .queryAllByRole('button', { name: /^Zoom .* times$/ })
        .filter((b) => b.props.accessibilityState?.selected)
        .map((b) => b.props.accessibilityLabel as string);
    const cameraZoom = () => screen.getByTestId('camera-live-preview').props.zoom as number;

    await openCamera('/camera?slot=afternoon');
    await fireEvent.press(zoomButton('3'));
    // The 3× telephoto is zoom 6 on the iPhone 14 Pro's back camera.
    expect(cameraZoom()).toBe(6);
    // Same rear camera, new moment: back to 1×, the wide lens at zoom 2.
    await openPicker();
    await pick('morning');
    expect(selected()).toEqual(['Zoom 1 times']);
    expect(cameraZoom()).toBe(2);
    // To #selfie: the front lens, which has no zoom buttons, at its own 1× (zoom 1).
    await fireEvent.press(zoomButton('2'));
    await openPicker();
    await pick('selfie');
    expect(screen.queryAllByRole('button', { name: /^Zoom .* times$/ })).toEqual([]);
    expect(cameraZoom()).toBe(1);
  });

  it('a new link into the open camera starts from its own slot, not the one picked before', async () => {
    await openCamera('/camera?slot=afternoon');
    await openPicker();
    await pick('evening');
    expect(tagText()).toMatch(/^#evening, /);
    await act(async () => router.setParams({ slot: 'ootd' }));
    expect(tagText()).toMatch(/^#ootd, today at /);
    await shoot();
    expect(saveCapture).toHaveBeenLastCalledWith(expect.objectContaining({ slot: 'ootd' }));
  });

  it('a new link follows the lens rule: off a picked #selfie it goes back to the rear lens, onto #selfie the front', async () => {
    await openCamera('/camera?slot=afternoon');
    await openPicker();
    await pick('selfie');
    // The rear camera's four zoom buttons; the front lens has none.
    const zoomButtons = () => screen.queryAllByRole('button', { name: /^Zoom .* times$/ });
    expect(zoomButtons()).toEqual([]);
    // Rear lens again for #ootd, because the front one was #selfie's choice.
    await act(async () => router.setParams({ slot: 'ootd' }));
    expect(zoomButtons()).toHaveLength(4);
    await act(async () => router.setParams({ slot: 'selfie' }));
    expect(tagText()).toMatch(/^#selfie, /);
    await shoot();
    expect(takeMockPhoto).toHaveBeenLastCalledWith('front');
  });

  it('when every other slot is done, the picker still opens with only the current slot to tap, which closes it', async () => {
    mockToday.queue = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'evening'].map((slot) =>
      queued(slot as QueuedMoment['slot']),
    );
    await openCamera('/camera?slot=afternoon');
    await openPicker();
    expect(screen.getByText('Every other moment is already done for this day')).toBeTruthy();
    const enabled = screen
      .getAllByTestId(/^camera-slot-picker-[a-z]+$/)
      .filter((r) => !r.props.accessibilityState.disabled)
      .map((r) => r.props.accessibilityLabel as string);
    expect(enabled).toEqual(['#afternoon']);
    await pick('afternoon');
    expect(pickerHeader()).toBeNull();
    expect(tagText()).toMatch(/^#afternoon, /);
  });
});
