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
