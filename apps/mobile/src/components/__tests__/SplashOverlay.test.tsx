import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import {
  SPLASH_COMPLETE_MS,
  SPLASH_FADE_MS,
  SPLASH_HOLD_LAYERS,
  SPLASH_LOADING_STEP_MS,
  SplashOverlay,
} from '../SplashOverlay';
import { splash } from '@/theme/tokens';

// Minimal Reanimated stand-in: shared values persist across renders, animations land at once (calling their
// done callback), and withTiming records what it was asked to do. Animated props are read at render time, so
// a test re-renders after an effect to see the new values.
jest.mock('react-native-reanimated', () => {
  const { createElement, useRef } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent:
        (C: React.ComponentType<Record<string, unknown>>) =>
        ({ animatedProps, ...rest }: { animatedProps: object }) =>
          createElement(C, { ...rest, ...animatedProps }),
    },
    Easing: { linear: 'linear', out: () => 'easeOut', cubic: 'cubic' },
    useReducedMotion: jest.fn(() => false),
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (fn: () => object) => fn(),
    useAnimatedProps: (fn: () => object) => fn(),
    withTiming: jest.fn((to: number, _config: unknown, done?: (finished: boolean) => void) => {
      done?.(true);
      return to;
    }),
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

const timing = () =>
  jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration]);
const layerOpacities = () => screen.getAllByTestId('splash-jar-layer').map((l) => Number(l.props.opacity));

describe('SplashOverlay', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
    jest.mocked(withTiming).mockClear();
  });

  it('starts as an empty jar with the logo, like the native launch image, and announces loading', async () => {
    await render(<SplashOverlay ready={false} onHidden={jest.fn()} />);
    expect(screen.getByLabelText('Pickld is loading')).toBeTruthy();
    expect(screen.getByTestId('splash-logo')).toBeTruthy();
    expect(screen.getAllByTestId('splash-jar-layer')).toHaveLength(8);
  });

  it('fills while loading, one layer every 150 ms up to 7, and stays up', async () => {
    const onHidden = jest.fn();
    const view = await render(<SplashOverlay ready={false} onHidden={onHidden} />);
    expect(timing()).toEqual([[7, 1050]]);
    await view.rerender(<SplashOverlay ready={false} onHidden={onHidden} />);
    expect(layerOpacities()).toEqual([1, 1, 1, 1, 1, 1, 1, 0]);
    expect(onHidden).not.toHaveBeenCalled();
  });

  it('hands over early once loading is done: fills the rest in 250 ms, fades out in 250 ms', async () => {
    const onHidden = jest.fn();
    const view = await render(<SplashOverlay ready={false} onHidden={onHidden} />);
    jest.mocked(withTiming).mockClear();
    await view.rerender(<SplashOverlay ready onHidden={onHidden} />);
    // The fill to 8, then the fade to 0; nothing waits for the loading pace.
    expect(timing()).toEqual([
      [8, 250],
      [0, 250],
    ]);
    expect(onHidden).toHaveBeenCalledTimes(1);
    await view.rerender(<SplashOverlay ready onHidden={onHidden} />);
    expect(layerOpacities()).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('hands over in half a second when the app is ready at once', async () => {
    const onHidden = jest.fn();
    await render(<SplashOverlay ready onHidden={onHidden} />);
    expect(timing()).toEqual([
      [8, 250],
      [0, 250],
    ]);
    expect(onHidden).toHaveBeenCalledTimes(1);
    expect(SPLASH_COMPLETE_MS + SPLASH_FADE_MS).toBe(500);
    expect(SPLASH_HOLD_LAYERS * SPLASH_LOADING_STEP_MS).toBe(1050);
  });

  it('with Reduce Motion: no fill, the jar stays empty, and it only cross-fades once ready', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const onHidden = jest.fn();
    const view = await render(<SplashOverlay ready={false} onHidden={onHidden} />);
    expect(timing()).toEqual([]);
    await view.rerender(<SplashOverlay ready onHidden={onHidden} />);
    expect(timing()).toEqual([[0, 250]]);
    expect(layerOpacities()).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('ships a native launch image drawn at 3x the splash canvas (200 × 560 pt)', () => {
    // PNG header: width and height are big-endian at bytes 16 and 20.
    const png = readFileSync(join(__dirname, '../../../assets/brand/splash.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([600, 1680]);
    expect([splash.canvasWidth * 3, splash.canvasHeight * 3]).toEqual([600, 1680]);
  });
});
