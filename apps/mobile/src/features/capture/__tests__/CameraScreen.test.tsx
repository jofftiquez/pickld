import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import CameraScreen from '../../../../app/camera';
import { takeMockPhoto } from '../mockCamera';
import { saveCapture } from '../saveCapture';
import type { QueuedMoment } from '@/features/jar/todayGrid';

// Camera screen wiring (FR-CAP-01): permission branch, dev mock camera, slot switcher, flash and flip,
// and the shutter path. vision-camera and the save path are mocked; saveCapture has its own test.

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

jest.mock('react-native-vision-camera', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  const photoOutput = { capturePhotoToFile: (...args: unknown[]) => mockCamera.capturePhotoToFile(...args) };
  return {
    Camera: (props: { isActive: boolean }) => <MockView testID="camera-live-preview" {...props} />,
    CommonResolutions: { FHD_4_3: { width: 1440, height: 1920 } },
    useCameraDevice: jest.fn((position: string) => ({ id: position, hasFlash: position === 'back' })),
    usePhotoOutput: () => photoOutput,
    useCameraPermission: jest.fn(() => ({
      hasPermission: mockCamera.permission === 'authorized',
      canRequestPermission: mockCamera.permission === 'not-determined',
      requestPermission: mockCamera.requestPermission,
    })),
    VisionCamera: { createDeviceFactory: async () => ({ cameraDevices: [{ id: 'back' }] }) },
  };
});

jest.mock('../mockCamera', () => ({
  ...jest.requireActual<typeof import('../mockCamera')>('../mockCamera'),
  takeMockPhoto: jest.fn(async () => 'file:///cache/mock-camera.jpg'),
}));

jest.mock('../saveCapture', () => ({ saveCapture: jest.fn() }));
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
  jest.mocked(saveCapture).mockImplementation(() => new Promise(() => undefined));
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

  it('switching the slot changes the target, and the shutter queues the mock photo there and returns', async () => {
    await openCamera();
    await fireEvent.press(screen.getByTestId('camera-slot-selfie'));
    expect(tagText()).toMatch(/^#selfie,/);
    expect(screen.getByRole('tab', { name: '#selfie', selected: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await act(async () => {});

    expect(takeMockPhoto).toHaveBeenCalledWith('back');
    // Back on Today while the photo is still being prepared (saveCapture never settles here).
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

  it('shows the access-off fallback when permission is denied', async () => {
    mockCamera.permission = 'denied';
    await openCamera();
    expect(screen.getByText('Camera access is off')).toBeTruthy();
    expect(mockCamera.requestPermission).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/today');
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
