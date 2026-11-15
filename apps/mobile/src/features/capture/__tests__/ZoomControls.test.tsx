// Gesture-handler's own jest mocks for its native module.
import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { GestureHandlerRootView, usePinchGesture } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { flatStyle } from '@/components/__tests__/testUtils';
import { colors, sizes } from '@/theme/tokens';

import { CameraTouchArea } from '../CameraTouchArea';
import { FOCUS_MARK_MS, FocusIndicator } from '../FocusIndicator';
import { ZoomControls } from '../ZoomControls';

// Zoom buttons, the pinch readout, and the tap to focus square (D-144). The Camera screen test covers the
// wiring to the camera; this one the controls themselves.

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('@/features/edit/__tests__/reanimatedStandIn'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
}));

// The visible chip inside a button (the button itself only takes the touch).
const chip = (factor: string) => screen.getByTestId(`camera-zoom-chip-${factor}`);
const factors = ['0.5', '1', '2', '3'];

const stops = [
  { factor: 0.5, zoom: 1 },
  { factor: 1, zoom: 2 },
  { factor: 2, zoom: 4 },
  { factor: 3, zoom: 6 },
];

describe('ZoomControls', () => {
  it('shows one button per lens, named for screen readers, with the current one selected', async () => {
    await render(<ZoomControls stops={stops} selected={1} pinchFactor={null} onSelect={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual([
      'Zoom 0.5 times',
      'Zoom 1 times',
      'Zoom 2 times',
      'Zoom 3 times',
    ]);
    expect(buttons.map((b) => b.props.accessibilityState.selected)).toEqual([false, true, false, false]);
    // The selected lens is a light chip; the others stay dark over the photo.
    expect(factors.map((f) => flatStyle(chip(f)).backgroundColor)).toEqual([
      colors.badge,
      colors.surface,
      colors.badge,
      colors.badge,
    ]);
    expect(screen.getByText('0.5×')).toBeTruthy();
    expect(screen.getByText('3×')).toBeTruthy();
    expect(screen.queryByTestId('camera-zoom-readout', { includeHiddenElements: true })).toBeNull();
  });

  it('every button has a 44 × 44 tap area', async () => {
    await render(<ZoomControls stops={stops} selected={0} pinchFactor={null} onSelect={jest.fn()} />);
    // The 36 pt chip plus the button's hitSlop.
    for (const f of factors) {
      const { minWidth, minHeight } = flatStyle(chip(f));
      const slop = screen.getByRole('button', { name: `Zoom ${f} times` }).props.hitSlop;
      expect(Number(minWidth) + slop.left + slop.right).toBeGreaterThanOrEqual(sizes.minTap);
      expect(Number(minHeight) + slop.top + slop.bottom).toBeGreaterThanOrEqual(sizes.minTap);
    }
  });

  it('pressing a button hands back its stop', async () => {
    const onSelect = jest.fn();
    await render(<ZoomControls stops={stops} selected={1} pinchFactor={null} onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom 3 times' }));
    expect(onSelect).toHaveBeenCalledWith({ factor: 3, zoom: 6 });
  });

  it('while pinching, shows the zoom above the buttons, hidden from screen readers', async () => {
    await render(<ZoomControls stops={stops} selected={2} pinchFactor={2.4} onSelect={jest.fn()} />);
    expect(screen.getByTestId('camera-zoom-readout', { includeHiddenElements: true })).toHaveTextContent('2.4×', {
      exact: true,
    });
    expect(screen.queryByTestId('camera-zoom-readout')).toBeNull();
  });

  it('a single-lens camera gets no buttons, only the readout while pinching', async () => {
    const { rerender } = await render(
      <ZoomControls stops={[]} selected={-1} pinchFactor={null} onSelect={jest.fn()} />,
    );
    expect(screen.toJSON()).toBeNull();
    await rerender(<ZoomControls stops={[]} selected={-1} pinchFactor={4} onSelect={jest.fn()} />);
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.getByTestId('camera-zoom-readout', { includeHiddenElements: true })).toHaveTextContent('4×');
  });
});

describe('FocusIndicator', () => {
  it('animates in and out', async () => {
    await render(<FocusIndicator left={10} top={20} />);
    const style = flatStyle(screen.getByTestId('camera-focus-mark', { includeHiddenElements: true }));
    expect(style).toMatchObject({ left: 10, top: 20 });
    expect(style).toHaveProperty('opacity');
  });

  it('with Reduce Motion it just shows, with no fade or scale', async () => {
    jest.mocked(useReducedMotion).mockReturnValueOnce(true);
    await render(<FocusIndicator left={10} top={20} />);
    const style = flatStyle(screen.getByTestId('camera-focus-mark', { includeHiddenElements: true }));
    expect(style).toMatchObject({ left: 10, top: 20 });
    expect(style).not.toHaveProperty('opacity');
    expect(style).not.toHaveProperty('transform');
  });
});

describe('CameraTouchArea', () => {
  function Area({ canFocus, onFocus }: { canFocus: boolean; onFocus: (p: { x: number; y: number }) => void }) {
    const pinch = usePinchGesture({ runOnJS: true });
    return (
      <GestureHandlerRootView>
        <CameraTouchArea pinch={pinch} canFocus={canFocus} onFocus={onFocus}>
          <View />
        </CameraTouchArea>
      </GestureHandlerRootView>
    );
  }
  const tap = (x: number, y: number) => {
    const controller = createGestureController('camera-tap');
    controller.begin({ x, y, absoluteX: x, absoluteY: y });
    controller.activate({ x, y, absoluteX: x, absoluteY: y });
    controller.end({ x, y, absoluteX: x, absoluteY: y });
  };
  const mark = () => screen.queryByTestId('camera-focus-mark', { includeHiddenElements: true });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a tap focuses there; the square shows, then goes away', async () => {
    const onFocus = jest.fn();
    await render(<Area canFocus onFocus={onFocus} />);
    await fireEvent(screen.getByTestId('camera-touch-area'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 400 } },
    });
    await act(() => tap(150, 200));
    expect(onFocus).toHaveBeenCalledWith({ x: 150, y: 200 });
    expect(mark()).toHaveStyle({ left: 114, top: 164 });
    await act(() => jest.advanceTimersByTime(FOCUS_MARK_MS - 1));
    expect(mark()).not.toBeNull();
    await act(() => jest.advanceTimersByTime(1));
    expect(mark()).toBeNull();
  });

  it('a lens that can’t focus ignores taps', async () => {
    const onFocus = jest.fn();
    await render(<Area canFocus={false} onFocus={onFocus} />);
    await fireEvent(screen.getByTestId('camera-touch-area'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 400 } },
    });
    await act(() => tap(150, 200));
    expect(onFocus).not.toHaveBeenCalled();
    expect(mark()).toBeNull();
  });
});
