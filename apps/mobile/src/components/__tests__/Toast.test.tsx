import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { useReducedMotion } from 'react-native-reanimated';

import { showToast, TOAST_DURATION_MS, useToastStore } from '@/lib/toast';
import { space } from '@/theme/tokens';

import { Toast, TOAST_SLIDE } from '../Toast';
import { ToastHost } from '../ToastHost';
import { flatStyle, expectMinTapArea } from './testUtils';

// Success toast (D-63). Reanimated is the editor's stand-in plus timing that finishes at once, so the
// test reads where the pill starts and when it calls onHidden.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('@/features/edit/__tests__/reanimatedStandIn'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
  withTiming: (to: number, _config: unknown, done?: (finished: boolean) => void) => {
    done?.(true);
    return to;
  },
}));
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('react-native-screens', () => ({
  FullWindowOverlay: ({ children }: { children: import('react').ReactNode }) => children,
}));

// Gestures need a root, as on a screen (ToastHost gives the toast its own).
const renderToast = (toast: ReactElement) => render(<GestureHandlerRootView>{toast}</GestureHandlerRootView>);

let announce: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  jest.mocked(useReducedMotion).mockReturnValue(false);
  useToastStore.setState({ current: null });
});
afterEach(() => {
  jest.useRealTimers();
  announce.mockRestore();
});

describe('Toast', () => {
  it('shows its line with a check, and the screen reader reads it aloud', async () => {
    await renderToast(<Toast message="Link copied" onHidden={jest.fn()} />);
    expect(screen.getByLabelText('Link copied')).toBeTruthy();
    expect(screen.getByText('Link copied')).toBeTruthy();
    expect(screen.getByTestId('icon-check', { includeHiddenElements: true })).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Link copied');
  });

  it('leaves on its own after about 2.5 seconds', async () => {
    const onHidden = jest.fn();
    await renderToast(<Toast message="Jar published" onHidden={onHidden} />);
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(onHidden).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onHidden).toHaveBeenCalledTimes(1);
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('slides down into place', async () => {
    await renderToast(<Toast message="Moment deleted" onHidden={jest.fn()} />);
    expect(flatStyle(screen.getByTestId('toast'))).toMatchObject({
      opacity: 0,
      transform: [{ translateY: -TOAST_SLIDE }],
    });
  });

  it('with Reduce Motion only fades in', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderToast(<Toast message="Moment deleted" onHidden={jest.fn()} />);
    expect(flatStyle(screen.getByTestId('toast'))).toMatchObject({ opacity: 0, transform: [{ translateY: 0 }] });
  });

  it('a swipe up lets it go; a small drag does not', async () => {
    const onHidden = jest.fn();
    await renderToast(<Toast message="Changes saved" onHidden={onHidden} />);
    const pan = createGestureController('toast-pan');
    await act(() => {
      pan.begin({ translationY: 0 });
      pan.activate({ translationY: 0 });
      pan.update({ translationY: -8 });
      pan.end({ translationY: -8 });
    });
    expect(onHidden).not.toHaveBeenCalled();
    await act(() => {
      pan.begin({ translationY: 0 });
      pan.activate({ translationY: 0 });
      pan.update({ translationY: -60 });
      pan.end({ translationY: -60 });
    });
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('the screen reader can dismiss it', async () => {
    const onHidden = jest.fn();
    await renderToast(<Toast message="Unblocked" onHidden={onHidden} />);
    const pill = screen.getByTestId('toast');
    expect(pill.props.accessibilityActions).toEqual([{ name: 'dismiss', label: 'Close' }]);
    await fireEvent(pill, 'accessibilityAction', { nativeEvent: { actionName: 'dismiss' } });
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('has room for an action such as a later Undo', async () => {
    const onHidden = jest.fn();
    const onPress = jest.fn();
    await renderToast(<Toast message="Moment deleted" action={{ label: 'Undo', onPress }} onHidden={onHidden} />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expectMinTapArea(undo);
    await fireEvent.press(undo);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onHidden).toHaveBeenCalledTimes(1);
  });
});

describe('ToastHost', () => {
  it('shows the latest showToast with its en.json text, then clears it', async () => {
    await render(<ToastHost />);
    expect(screen.queryByTestId('toast')).toBeNull();
    await act(() => showToast('momentMoved', { slot: '#evening' }));
    expect(screen.getByText('Moment moved to #evening')).toBeTruthy();
    expect(announce).toHaveBeenLastCalledWith('Moment moved to #evening');

    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByTestId('toast')).toBeNull();
    expect(useToastStore.getState().current).toBeNull();
  });

  it('a new toast replaces the one on screen and gets its own time', async () => {
    await render(<ToastHost />);
    await act(() => showToast('linkCopied'));
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 500));
    await act(() => showToast('imageSaved'));
    expect(screen.queryByText('Link copied')).toBeNull();
    expect(screen.getByText('Saved to Photos')).toBeTruthy();

    await act(() => jest.advanceTimersByTime(500));
    expect(screen.getByText('Saved to Photos')).toBeTruthy();
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 500));
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('sits under the status bar', async () => {
    await render(<ToastHost />);
    await act(() => showToast('jarPublished'));
    expect(flatStyle(screen.getByTestId('toast-host')).top).toBe(47 + space.sm);
  });
});
