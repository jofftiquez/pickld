import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { FloatingTabBar } from '../FloatingTabBar';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

// The navigator's routes include the hidden Capture route (`href: null`); it must get no tab (D-52).
const routes = ['today', 'capture', 'jars'].map((name) => ({ key: `${name}-key`, name }));
const labels = ['Today', 'Jars'];

function setup({ index = 0, preventDefault = false, insets = { top: 0, right: 0, bottom: 0, left: 0 } } = {}) {
  const emit = jest.fn(() => ({ defaultPrevented: preventDefault }));
  const navigateToTab = jest.fn();
  const props = {
    state: { index, routes },
    descriptors: {},
    emitter: { emit },
    navigateToTab,
    insets,
  } as unknown as BottomTabBarProps;
  return { props, emit, navigateToTab };
}

describe('FloatingTabBar', () => {
  it('shows Today and Jars in order with translated labels inside a named tablist, and no Capture tab', async () => {
    const { props } = setup();
    await render(<FloatingTabBar {...props} />);
    expect(screen.getByLabelText('Main').props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual(labels);
    for (const label of labels) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByTestId('tab-capture')).toBeNull();
    expect(screen.queryByText('Capture')).toBeNull();
  });

  it('announces only the focused tab as selected and highlights it per Main', async () => {
    const { props } = setup({ index: 2 });
    await render(<FloatingTabBar {...props} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityState.selected)).toEqual([false, true]);
    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Jars', selected: true })).toBeTruthy();

    expect(flatStyle(screen.getByTestId('tab-active-pill'))).toMatchObject({
      width: sizes.tabPillWidth,
      height: sizes.tabPillHeight,
      backgroundColor: colors.brandTint,
    });
    expect(screen.getAllByTestId('tab-active-pill')).toHaveLength(1);
    expect(screen.getByText('Jars').props.style).toEqual(expect.arrayContaining([{ color: colors.brandText }]));
    const icon = (name: string) => screen.getByTestId(`icon-${name}`, { includeHiddenElements: true }).props;
    expect(icon('jars').stroke).toBe(colors.brandText);
    expect(icon('jars').strokeWidth).toBe(2);
  });

  it('Today gets no highlight while Jars is selected, and the same tinted pill as any tab when selected', async () => {
    const icon = () => screen.getByTestId('icon-today', { includeHiddenElements: true }).props;

    const other = setup({ index: 2 });
    await render(<FloatingTabBar {...other.props} />);
    expect(icon().stroke).toBe(colors.muted);
    expect(screen.getByText('Today').props.style).toEqual(expect.arrayContaining([{ color: colors.muted }]));
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toEqual({ selected: false });

    const today = setup({ index: 0 });
    await render(<FloatingTabBar {...today.props} />);
    expect(screen.getAllByTestId('tab-active-pill')).toHaveLength(1);
    expect(flatStyle(screen.getByTestId('tab-active-pill'))).toMatchObject({ backgroundColor: colors.brandTint });
    expect(flatStyle(screen.getByTestId('tab-active-pill')).borderWidth).toBeUndefined();
    expect(icon().stroke).toBe(colors.brandText);
    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeTruthy();
  });

  it('pressing an unfocused tab emits tabPress and navigates to that route', async () => {
    const { props, emit, navigateToTab } = setup({ index: 0 });
    await render(<FloatingTabBar {...props} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Jars' }));
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'jars-key', canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledTimes(1);
    expect(navigateToTab).toHaveBeenCalledWith('jars-key');
  });

  it('does not navigate when the tab is already focused or a listener prevents it', async () => {
    const focused = setup({ index: 2 });
    await render(<FloatingTabBar {...focused.props} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Jars' }));
    expect(focused.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'jars-key' }));
    expect(focused.navigateToTab).not.toHaveBeenCalled();

    const prevented = setup({ index: 0, preventDefault: true });
    await render(<FloatingTabBar {...prevented.props} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Jars' }));
    expect(prevented.navigateToTab).not.toHaveBeenCalled();
  });

  it('every tab is at least 44 × 44', async () => {
    const { props } = setup();
    await render(<FloatingTabBar {...props} />);
    for (const tab of screen.getAllByRole('tab')) {
      expectMinTapArea(tab);
      expect(flatStyle(tab).minHeight).toBe(sizes.tabBar);
    }
  });

  it('floats inset from the edges, above the home indicator, with glass, blur and the floating shadow', async () => {
    const { props } = setup({ insets: { top: 47, right: 0, bottom: 34, left: 0 } });
    await render(<FloatingTabBar {...props} />);
    const bar = flatStyle(screen.getByTestId('floating-tab-bar'));
    expect(bar).toMatchObject({
      position: 'absolute',
      left: space.md,
      right: space.md,
      bottom: 34,
      borderRadius: radius.tabBar,
      backgroundColor: colors.tabBarGlass,
      ...shadow.floating,
    });
    expect(screen.getByTestId('tab-bar-blur')).toBeTruthy();
  });

  it('keeps the design gap from the screen edge on devices without a home indicator', async () => {
    const { props } = setup();
    await render(<FloatingTabBar {...props} />);
    expect(flatStyle(screen.getByTestId('floating-tab-bar')).bottom).toBe(space.lg);
  });
});
