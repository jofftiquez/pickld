import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import TabsLayout from '../../../app/(tabs)/_layout';
import JarsScreen from '../../../app/(tabs)/jars';
import MomentsScreen from '../../../app/(tabs)/moments';
import TodayScreen from '../../../app/(tabs)/today';
import MyDaysScreen from '../../../app/my-days';

// Today draws a JarGraphic, which needs Reanimated's native worklets; expo-router's testing mocks
// replace Reanimated with its own mock, which can't load under Jest in this version. The jar isn't
// under test here.
// Moment options' bottom sheet needs the full Reanimated and gesture-handler mocks; it has its own tests.
jest.mock('@/features/moment/MomentOptions', () => ({ MomentOptions: () => null }));
jest.mock('@/features/onboarding/FirstMomentTip', () => ({ FirstMomentTip: () => null }));
jest.mock('@/features/publish/JarVisibilitySheet', () => ({ JarVisibilitySheet: () => null }));
// The tiles' pop and the publish burst (D-58) use Reanimated, which the router test harness can't load; they
// have their own tests.
jest.mock('@/features/jar/TilePop', () => ({ TilePop: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/jar/PublishBurst', () => ({ PublishBurst: () => null }));
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));
// Today's Retry reaches the upload worker, which reports errors through Sentry (ESM, not loadable here).
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

// Today reads its data with React Query (signed out here, so no query runs).
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

// The real route files from app/, wired through Expo Router's in-memory router.
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/today': TodayScreen,
  '(tabs)/moments': MomentsScreen,
  '(tabs)/capture': () => null,
  '(tabs)/jars': JarsScreen,
  'my-days': MyDaysScreen,
};

// D-52: Today | Moments | Jars. Capture is hidden (its route opens the camera: see
// features/capture/__tests__/captureTab.test.tsx) and My days is a stack screen opened from Today.
const tabs = [
  { label: 'Today', path: '/today' },
  { label: 'Moments', path: '/moments' },
  { label: 'Jars', path: '/jars' },
];

describe('tab shell', () => {
  // Where the app opens (Welcome, About you or Today) is in features/onboarding/__tests__/StartRoute.test.tsx.
  it('shows Today with the floating tab bar', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    expect(screen).toHavePathname('/today');
    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeTruthy();
    expect(screen.getByTestId('floating-tab-bar')).toBeTruthy();
  });

  it('tapping each tab switches route, title and selected state', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    for (const { label, path } of tabs) {
      await fireEvent.press(screen.getByRole('tab', { name: label }));
      expect(screen).toHavePathname(path);
      expect(screen.getAllByRole('tab', { selected: true }).map((tab) => tab.props.accessibilityLabel)).toEqual([
        label,
      ]);
      // The screen title, not just the tab label, is on screen.
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2);
    }
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual(['Today', 'Moments', 'Jars']);
  });

  it('opens My days from Today’s calendar button, over the tabs, and Back returns to Today', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'My days' }));
    expect(screen).toHavePathname('/my-days');
    expect(screen.getByRole('header', { name: 'My days' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen).toHavePathname('/today');
  });

  // D-108: iOS 26+ with glass allowed gets the system's Liquid Glass tab bar; Reduce Transparency keeps the custom one.
  describe('on iOS 26', () => {
    beforeEach(() => {
      jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
      jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(true);
    });
    afterEach(() => {
      jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
      jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(false);
      jest.restoreAllMocks();
    });

    it('uses the native tab bar instead of the floating one', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
      await renderRouter(routes, { initialUrl: '/today', wrapper });
      expect(await screen.findByRole('header', { name: 'Today' })).toBeTruthy();
      expect(screen.queryByTestId('floating-tab-bar')).toBeNull();
    });

    it('keeps the floating tab bar with Reduce Transparency on', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
      await renderRouter(routes, { initialUrl: '/today', wrapper });
      expect(await screen.findByTestId('floating-tab-bar')).toBeTruthy();
    });
  });
});
