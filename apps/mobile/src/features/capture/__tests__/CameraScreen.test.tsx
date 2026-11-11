import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { AppState, Linking, Pressable, Text, View, type AppStateStatus } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import CameraScreen from '../../../../app/camera';
import { parseDevPhotoParam, parseMockAccessParam, pickDevPhoto, takeMockPhoto } from '../mockCamera';
import { usePendingCrop } from '../pendingCrop';
import { pickFromGallery } from '../pickFromGallery';
import { saveCapture, saveGalleryPhoto } from '../saveCapture';
import { captureError } from '@/lib/monitoring';
import type { DayJar } from '@/features/days/useDayJar';
import type { QueuedMoment, ServerMoment } from '@/features/jar/todayGrid';

// Camera screen wiring (FR-CAP-01, FR-CAP-11): permission branch and Camera access off, dev mock camera,
// slot switcher, flash and flip, and the shutter path. vision-camera's native module and the save path
// are mocked; its permission hook is the real one (it re-reads the status when the app becomes active).
// saveCapture has its own test.

const mockCamera = {
  isDevice: false,
  permission: 'authorized' as 'authorized' | 'not-determined' | 'denied',
  capturePhotoToFile: jest.fn(async (..._args: unknown[]) => ({ filePath: '/tmp/vc-shot.jpg' })),
  requestPermission: jest.fn(async () => true),
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
  const { useCameraPermission: realUseCameraPermission } = jest.requireActual<
    typeof import('react-native-vision-camera/lib/hooks/usePermission')
  >('react-native-vision-camera/lib/hooks/usePermission');
  const photoOutput = { capturePhotoToFile: (...args: unknown[]) => mockCamera.capturePhotoToFile(...args) };
  return {
    Camera: (props: { isActive: boolean }) => <MockView testID="camera-live-preview" {...props} />,
    CommonResolutions: { FHD_4_3: { width: 1440, height: 1920 } },
    useCameraDevice: jest.fn((position: string) => ({ id: position, hasFlash: position === 'back' })),
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
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
// The Replace dialog (kit Dialog) reads Reduce Motion from Reanimated. expo-router's testing library mocks
// Reanimated with `react-native-reanimated/mock`, which can't load here; give it the one hook it needs.
jest.mock('react-native-reanimated/mock', () => ({ __esModule: true, default: {}, useReducedMotion: () => false }));

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
    jar: { hasAnyJar: true, jar: mockToday.jar, moments: [] },
    queue: mockToday.queue,
  }),
}));

// Fill this jar reads the target day's jar; null `day` means it has none.
const mockDay = { day: undefined as DayJar | undefined, dates: [] as (string | null)[] };
jest.mock('@/features/days/useDayJar', () => ({
  useDayJar: (date: string | null) => {
    mockDay.dates.push(date);
    return { userId: mockToday.userId, day: date ? mockDay.day : undefined, queue: mockToday.queue };
  },
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

async function openCamera(url = '/camera?slot=afternoon') {
  await renderRouter(routes, { initialUrl: '/today', wrapper });
  await act(async () => {
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    router.push(url);
  });
  expect(screen).toHavePathname('/camera');
}

const tagText = () => screen.getByTestId('camera-slot-tag').props.accessibilityLabel as string;

beforeEach(() => {
  mockCamera.isDevice = false;
  mockCamera.permission = 'authorized';
  mockCamera.capturePhotoToFile.mockClear();
  mockCamera.requestPermission.mockClear();
  jest.mocked(useCameraDevice).mockClear();
  jest.mocked(useCameraPermission).mockClear();
  jest.mocked(takeMockPhoto).mockClear();
  jest.mocked(saveCapture).mockReset();
  jest.mocked(pickFromGallery).mockReset();
  jest.mocked(pickFromGallery).mockResolvedValue(null);
  jest.mocked(pickDevPhoto).mockClear();
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
  mockDay.day = undefined;
  mockDay.dates = [];
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

  it('switching the slot changes the target, and the shutter queues the mock photo there and returns', async () => {
    await openCamera();
    await fireEvent.press(screen.getByTestId('camera-slot-selfie'));
    expect(tagText()).toMatch(/^#selfie,/);
    expect(screen.getByRole('tab', { name: '#selfie', selected: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});

    expect(takeMockPhoto).toHaveBeenCalledWith('back');
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
    await openCamera();
    await fireEvent.press(screen.getByTestId('camera-slot-selfie'));
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

  it('flip takes the front fixture', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Flip camera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(takeMockPhoto).toHaveBeenCalledWith('front');
  });

  it('taken slots are listed but cannot be picked', async () => {
    mockToday.queue = [
      {
        id: 1,
        slot: 'selfie',
        state: 'queued',
        localDate: '2026-11-11',
        photoUri: 'file:///q/1.webp',
        thumbUri: null,
        capturedAt: null,
        isPrivate: false,
      },
    ];
    await openCamera();
    const selfie = screen.getByRole('tab', { name: '#selfie, already added' });
    expect(selfie.props.accessibilityState).toEqual({ selected: false, disabled: true });
    await fireEvent.press(selfie);
    expect(tagText()).toMatch(/^#afternoon,/);
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
      isPrivate: false,
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
    expect(jest.mocked(useCameraDevice)).toHaveBeenLastCalledWith('front');
    expect(screen.getByRole('button', { name: 'Flash off' }).props.accessibilityState).toEqual({ disabled: true });
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

describe('Fill this jar (?date=, FR-DAY-02)', () => {
  const dayMoment = (slot: ServerMoment['slot']): ServerMoment => ({
    id: `m-${slot}`,
    slot,
    status: 'live',
    is_private: false,
    is_backfilled: false,
    captured_at: null,
    added_at: '2026-11-08T01:00:00Z',
    thumbUrl: null,
  });
  const queued = (slot: QueuedMoment['slot'], localDate: string): QueuedMoment => ({
    id: Math.floor(Math.random() * 1e6),
    slot,
    state: 'queued',
    localDate,
    photoUri: 'file:///q/x.webp',
    thumbUri: null,
    capturedAt: null,
    isPrivate: false,
  });

  beforeEach(() => {
    mockDay.day = {
      jar: { id: 'jar-8', localDate: '2026-11-08', tz: 'Asia/Tokyo' },
      moments: [dayMoment('whereami'), dayMoment('morning')],
    };
  });

  it('targets the past day: the tag names it and the shutter queues there in that jar’s zone', async () => {
    await openCamera('/camera?date=2026-11-08&slot=selfie');
    expect(mockDay.dates).toContain('2026-11-08');
    expect(tagText()).toBe('#selfie, for Sun, Nov 8');
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(saveCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        slot: 'selfie',
        tz: 'Asia/Manila',
        fill: { localDate: '2026-11-08', tz: 'Asia/Tokyo' },
      }),
    );
    // Like any capture, the editor opens for the queued photo (M2-12).
    expect(screen).toHavePathname('/edit/1');
  });

  it('only the day’s missing slots are selectable; today’s jar doesn’t count', async () => {
    // Today's jar has #selfie queued; the day being filled doesn't.
    mockToday.queue = [queued('selfie', '2026-11-11'), queued('ootd', '2026-11-08')];
    await openCamera('/camera?date=2026-11-08&slot=selfie');
    for (const name of ['#whereami, already added', '#morning, already added', '#ootd, already added']) {
      expect(screen.getByRole('tab', { name }).props.accessibilityState).toEqual({ selected: false, disabled: true });
    }
    await fireEvent.press(screen.getByRole('tab', { name: '#morning, already added' }));
    expect(tagText()).toMatch(/^#selfie,/);
    expect(screen.getByRole('tab', { name: '#selfie', selected: true })).toBeTruthy();
  });

  it('a slot param that is already filled opens on the first missing slot instead', async () => {
    await openCamera('/camera?date=2026-11-08&slot=morning');
    expect(tagText()).toMatch(/^#mebusywith, for /);
  });

  it('a day without a jar queues in the phone zone', async () => {
    mockDay.day = { jar: null, moments: [] };
    await openCamera('/camera?date=2026-11-08&slot=ootd');
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(saveCapture).toHaveBeenCalledWith(
      expect.objectContaining({ slot: 'ootd', fill: { localDate: '2026-11-08', tz: 'Asia/Manila' } }),
    );
  });

  it('a gallery photo from Fill this jar goes to the day being filled, whatever its own date', async () => {
    jest.mocked(pickFromGallery).mockResolvedValue({
      uri: 'file:///picker/p.jpg',
      width: 300,
      height: 400,
      exif: { DateTimeOriginal: '2026:11:02 09:00:00', OffsetTimeOriginal: '+08:00' },
    });
    await openCamera('/camera?date=2026-11-08&slot=selfie');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(saveGalleryPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        slot: 'selfie',
        target: { localDate: '2026-11-08', tz: 'Asia/Tokyo', capturedAt: '2026-11-02T09:00:00+08:00' },
      }),
    );
  });

  it('a full past jar has nothing to fill: the shutter is disabled', async () => {
    const all = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'] as const;
    mockDay.day = { jar: { id: 'jar-8', localDate: '2026-11-08', tz: 'Asia/Tokyo' }, moments: all.map(dayMoment) };
    await openCamera('/camera?date=2026-11-08');
    expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState).toEqual({ disabled: true });
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
    expect(saveCapture).toHaveBeenCalledWith(expect.objectContaining({ openJar: mockToday.jar, fill: null }));
  });
});
