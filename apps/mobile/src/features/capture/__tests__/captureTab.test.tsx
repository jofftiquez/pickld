import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import TabsLayout from '../../../../app/(tabs)/_layout';
import CaptureScreen from '../../../../app/(tabs)/capture';
import JarsScreen from '../../../../app/(tabs)/jars';
import MyDaysScreen from '../../../../app/(tabs)/my-days';
import TodayScreen from '../../../../app/(tabs)/today';
import Index from '../../../../app/index';

// See TabShell.test.tsx: Reanimated can't load here, and the jar isn't under test.
// Moment options' bottom sheet needs the full Reanimated and gesture-handler mocks; it has its own tests.
jest.mock('@/features/moment/MomentOptions', () => ({ MomentOptions: () => null }));
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));
// Today pulls in the upload runner, which loads Sentry (ESM) through monitoring.
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

// Stands in for app/camera.tsx (tested in CameraScreen.test.tsx): shows its slot param and can go back.
function CameraStub() {
  const router = useRouter();
  const { slot } = useLocalSearchParams<{ slot?: string }>();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={() => router.back()}>
      <Text>{`camera slot: ${slot ?? 'none'}`}</Text>
    </Pressable>
  );
}

// Like app/_layout.tsx: a stack, with the camera pushed over the tabs.
function RootStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

const routes = {
  _layout: RootStack,
  index: Index,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/today': TodayScreen,
  '(tabs)/capture': CaptureScreen,
  '(tabs)/jars': JarsScreen,
  '(tabs)/my-days': MyDaysScreen,
  camera: CameraStub,
};

async function closeCamera() {
  await fireEvent.press(screen.getByRole('button', { name: 'Close camera' }));
  await act(async () => {});
}

describe('Capture tab', () => {
  it('opens the camera, and closing it lands on Today', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await fireEvent.press(screen.getByRole('tab', { name: 'Capture' }));
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera slot: none')).toBeTruthy();

    await closeCamera();
    expect(screen).toHavePathname('/today');
    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeTruthy();

    // And it opens again on the next tap.
    await fireEvent.press(screen.getByRole('tab', { name: 'Capture' }));
    expect(screen).toHavePathname('/camera');
  });

  it('passes the slot of a Today tile to the camera, and forgets it afterwards', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera slot: ootd')).toBeTruthy();

    await closeCamera();
    expect(screen).toHavePathname('/today');

    await fireEvent.press(screen.getByRole('tab', { name: 'Capture' }));
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera slot: none')).toBeTruthy();
  });

  it('ignores a slot param that is not a slot', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await act(async () => {
      const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
      router.push('/capture?slot=sunrise');
    });
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera slot: none')).toBeTruthy();
  });
});
