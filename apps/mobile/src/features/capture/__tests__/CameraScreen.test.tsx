import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { AppState, Linking, Text, View, type AppStateStatus } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import CameraScreen from '../../../../app/camera';
import { parseMockAccessParam, takeMockPhoto } from '../mockCamera';
import { pickFromGallery } from '../pickFromGallery';
import { saveCapture } from '../saveCapture';
import { captureError } from '@/lib/monitoring';
import type { QueuedMoment } from '@/features/jar/todayGrid';

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
}));

jest.mock('../saveCapture', () => ({ saveCapture: jest.fn() }));
jest.mock('../pickFromGallery', () => ({
  pickFromGallery: jest.fn(
    jest.requireActual<typeof import('../pickFromGallery')>('../pickFromGallery').pickFromGallery,
  ),
}));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

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
  jest.mocked(pickFromGallery).mockClear();
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
    expect(screen).toHavePathname('/today');
  });

  it('switching the slot changes the target, and the shutter queues the mock photo there and returns', async () => {
    await openCamera();
    await fireEvent.press(screen.getByTestId('camera-slot-selfie'));
    expect(tagText()).toMatch(/^#selfie,/);
    expect(screen.getByRole('tab', { name: '#selfie', selected: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});

    expect(takeMockPhoto).toHaveBeenCalledWith('back');
    // Back on Today once the raw photo is queued (preparing and uploading run behind it).
    expect(screen).toHavePathname('/today');
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

  it('the gallery shortcut calls the picker and reports that it is not installed yet', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await act(async () => {});
    expect(pickFromGallery).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'gallery' });
    expect(screen).toHavePathname('/camera');
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

  it('ignores a slot param that is not a slot', async () => {
    await openCamera('/camera?slot=brunch');
    expect(tagText()).not.toMatch(/brunch/);
  });

  it('opened by a deep link, the shutter still lands on Today', async () => {
    await renderRouter(routes, { initialUrl: '/camera?slot=ootd', wrapper });
    expect(tagText()).toMatch(/^#ootd,/);
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});
    expect(screen).toHavePathname('/today');
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
    expect(screen).toHavePathname('/today');
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

  it('Choose from gallery calls the picker; until it is installed the error is reported and the screen stays', async () => {
    await openCamera();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery instead' }));
    await act(async () => {});
    expect(pickFromGallery).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'gallery picker not installed' }), {
      area: 'gallery',
    });
    expect(screen).toHavePathname('/camera');
    expect(screen.getByTestId('camera-access-off')).toBeTruthy();
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
