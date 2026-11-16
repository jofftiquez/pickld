import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import TabsLayout from '../../../app/(tabs)/_layout';
import { colors } from '@/theme/tokens';

// The tab bars' red dots (FR-EXP-04, D-157) as the tab layout draws them; when each dot shows is in
// features/feed/__tests__/useTabUnread.test.tsx.
const mockUnread = { moments: false, jars: false };
jest.mock('@/features/feed/useTabUnread', () => ({
  useMomentsUnread: () => mockUnread.moments,
  useJarsUnread: () => mockUnread.jars,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/today': () => null,
  '(tabs)/moments': () => null,
  '(tabs)/capture': () => null,
  '(tabs)/jars': () => null,
  '(tabs)/discover': () => null,
};

type Rendered = { type: string; props: Record<string, unknown>; children: Rendered[] | null } | string;

/** The system tab bar's tabs, in order, from the rendered native tab screens. */
function nativeTabs(node: unknown): Record<string, unknown>[] {
  const nodes = Array.isArray(node) ? node : [node];
  return nodes.flatMap((n: Rendered | null) =>
    n === null || typeof n === 'string'
      ? []
      : n.type === 'RNSTabsScreenIOS' && typeof n.props.title === 'string'
        ? [n.props]
        : nativeTabs(n.children ?? []),
  );
}

beforeEach(() => Object.assign(mockUnread, { moments: false, jars: false }));

describe('tab dots in the system tab bar (iOS 26)', () => {
  beforeEach(() => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(true);
  });
  afterEach(() => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
    jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(false);
    jest.restoreAllMocks();
  });

  /** Each native tab: name, VoiceOver label, the system badge's text (none: no badge), and the badge's color. */
  async function tabs() {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await waitFor(() => expect(nativeTabs(screen.toJSON())).toHaveLength(4));
    return nativeTabs(screen.toJSON()).map((p) => ({
      title: p.title,
      label: p.tabBarItemAccessibilityLabel,
      badge: p.badgeValue,
      color: p.badgeBackgroundColor,
    }));
  }

  // A zero-width space: the patched system badge is then just an 8 pt dot (D-159).
  const dot = '\u200B';

  it('draws the system badge as a small dot on Moments and Jars in the unread red, and says so in each label', async () => {
    Object.assign(mockUnread, { moments: true, jars: true });
    expect(await tabs()).toEqual([
      { title: 'Today', label: 'Today', badge: undefined, color: colors.unreadDot },
      { title: 'Moments', label: 'Moments, new moments', badge: dot, color: colors.unreadDot },
      { title: 'Jars', label: 'Jars, new jars', badge: dot, color: colors.unreadDot },
      { title: 'Discover', label: 'Discover', badge: undefined, color: colors.unreadDot },
    ]);
  });
});

describe('tab dots in the floating tab bar', () => {
  it('shows a dot on each unread tab, read after its name', async () => {
    Object.assign(mockUnread, { moments: true, jars: true });
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    expect(await screen.findByTestId('floating-tab-bar')).toBeTruthy();
    expect(screen.queryAllByTestId(/^tab-.*-dot$/).map((dot) => dot.props.testID)).toEqual([
      'tab-moments-dot',
      'tab-jars-dot',
    ]);
    expect(screen.getByRole('tab', { name: 'Moments' }).props.accessibilityValue).toEqual({ text: 'new moments' });
    expect(screen.getByRole('tab', { name: 'Jars' }).props.accessibilityValue).toEqual({ text: 'new jars' });
    // Discover never has a dot (0150).
    expect(screen.getByRole('tab', { name: 'Discover' }).props.accessibilityValue?.text).toBeUndefined();
  });
});
