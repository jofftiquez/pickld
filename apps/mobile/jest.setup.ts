// Real translations in tests, so assertions check the copy users see.
import '@/i18n';

// Skia's native canvas can't load in Jest. Screens that draw moments (Today's tiles, M2-18) get plain
// views that show what would be drawn: the decoded image's URI and the filter's matrix. A test file's
// own jest.mock of the module replaces this one.
jest.mock('@shopify/react-native-skia', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Canvas: ({ children, testID }: { children?: import('react').ReactNode; testID?: string }) =>
      createElement(View, { testID }, children),
    Image: ({ children, image }: { children?: import('react').ReactNode; image: { uri: string } | null }) =>
      createElement(View, { testID: 'skia-image', accessibilityHint: image?.uri }, children),
    ColorMatrix: ({ matrix }: { matrix: number[] }) =>
      createElement(View, { testID: 'color-matrix', accessibilityValue: { text: JSON.stringify(matrix) } }),
    useImage: (uri: string | undefined) => (uri ? { uri } : null),
  };
});

// React Native's Jest preset reports a 2× system text size, which would put every screen in its large-text
// layout (D-37). Tests start at the default size; a test of large text sets fontScale itself.
{
  const { Dimensions } = jest.requireActual<typeof import('react-native')>('react-native');
  Dimensions.set({
    window: { ...Dimensions.get('window'), fontScale: 1 },
    screen: { ...Dimensions.get('screen'), fontScale: 1 },
  });
}

// Home screen widgets (M6-09) need the native extension, which tests don't have; the widget layouts run in
// the widget's own JavaScript runtime, never in Jest.
jest.mock('expo-widgets', () => {
  const widget = { updateTimeline: jest.fn(), updateSnapshot: jest.fn(), reload: jest.fn() };
  return { createWidget: () => widget, widgetsDirectory: null };
});
jest.mock('@/features/widgets/widgets', () => ({
  TodayWidget: { updateTimeline: jest.fn(), updateSnapshot: jest.fn() },
  FriendWidget: { updateTimeline: jest.fn(), updateSnapshot: jest.fn() },
  widgetColors: {},
}));

// Liquid Glass (D-57) is native and iOS 26 only. Tests run the blur look by default; GlassView is a plain view
// that keeps its props, so a test that turns glass on (GlassSurface.test) can check what would be drawn.
jest.mock('expo-glass-effect', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const glass = (props: import('react-native').ViewProps) => createElement(View, props);
  return {
    GlassView: glass,
    GlassContainer: glass,
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => false),
  };
});

// Haptics (D-58) need the phone's haptic engine. Tests read the calls off these mocks.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Reanimated's native worklets can't load in Jest. Files without their own mock get a stand-in where
// animations land at once (the screens' pops and the publish burst, D-58).
jest.mock('react-native-reanimated', () => jest.requireActual('@/features/edit/__tests__/reanimatedStandIn'));
