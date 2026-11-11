import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import TabsLayout from '../../../app/(tabs)/_layout';
import JarsScreen from '../../../app/(tabs)/jars';
import MyDaysScreen from '../../../app/(tabs)/my-days';
import TodayScreen from '../../../app/(tabs)/today';
import Index from '../../../app/index';

// Today draws a JarGraphic, which needs Reanimated's native worklets; expo-router's testing mocks
// replace Reanimated with its own mock, which can't load under Jest in this version. The jar isn't
// under test here.
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));
// Today's Retry reaches the upload worker, which reports errors through Sentry (ESM, not loadable here).
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

// Today reads its data with React Query (signed out here, so no query runs).
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

// The real route files from app/, wired through Expo Router's in-memory router.
const routes = {
  index: Index,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/today': TodayScreen,
  '(tabs)/capture': () => null,
  '(tabs)/jars': JarsScreen,
  '(tabs)/my-days': MyDaysScreen,
};

// Capture opens the full-screen camera instead of a tab screen: see features/capture/__tests__/captureTab.test.tsx.
const tabs = [
  { label: 'Today', path: '/today' },
  { label: 'Jars', path: '/jars' },
  { label: 'My days', path: '/my-days' },
];

describe('tab shell', () => {
  it('opens on Today with the floating tab bar', async () => {
    await renderRouter(routes, { initialUrl: '/', wrapper });
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
  });
});
