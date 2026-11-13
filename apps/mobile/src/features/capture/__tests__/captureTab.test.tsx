import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import TabsLayout from '../../../../app/(tabs)/_layout';
import CaptureScreen from '../../../../app/(tabs)/capture';
import JarsScreen from '../../../../app/(tabs)/jars';
import TodayScreen from '../../../../app/(tabs)/today';
import Index from '../../../../app/index';

// See TabShell.test.tsx: Reanimated can't load here, and the jar isn't under test.
// Moment options' bottom sheet needs the full Reanimated and gesture-handler mocks; it has its own tests.
jest.mock('@/features/moment/MomentOptions', () => ({ MomentOptions: () => null }));
jest.mock('@/features/onboarding/FirstMomentTip', () => ({ FirstMomentTip: () => null }));
jest.mock('@/features/publish/JarVisibilitySheet', () => ({ JarVisibilitySheet: () => null }));
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
  camera: CameraStub,
};

async function closeCamera() {
  await fireEvent.press(screen.getByRole('button', { name: 'Close camera' }));
  await act(async () => {});
}

// The Capture tab is hidden (D-52, `href: null`); its route file stays. Today's tiles open /camera directly.
describe('Capture from Today', () => {
  it('has no Capture tab in the bar', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    expect(screen.queryByRole('tab', { name: 'Capture' })).toBeNull();
    expect(screen.queryByTestId('tab-capture')).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it("opens the camera with the tile's slot, and closing it lands on Today", async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera slot: ootd')).toBeTruthy();

    await closeCamera();
    expect(screen).toHavePathname('/today');
    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeTruthy();

    // And another tile opens it again with its own slot.
    await fireEvent.press(screen.getByTestId('tile-selfie'));
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera slot: selfie')).toBeTruthy();
  });
});
