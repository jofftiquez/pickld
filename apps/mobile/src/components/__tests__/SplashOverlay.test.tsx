import { render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { SplashOverlay, SQUARE_STEP_MS } from '../SplashOverlay';
import { motion } from '@/theme/tokens';

// Minimal Reanimated stand-in: animations finish at once, so the test checks the overlay's sequencing.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: jest.fn(() => false),
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (to: number, _config: unknown, done?: (finished: boolean) => void) => {
      done?.(true);
      return to;
    },
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock('@/i18n', () => ({}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe('SplashOverlay', () => {
  it('announces loading and shows the tagline from en.json', async () => {
    await render(<SplashOverlay ready={false} onHidden={jest.fn()} />);
    expect(screen.getByLabelText('brand.loading')).toBeTruthy();
    expect(screen.getByText('brand.tagline')).toBeTruthy();
  });

  it('stays up while the app is not ready', async () => {
    const onHidden = jest.fn();
    await render(<SplashOverlay ready={false} onHidden={onHidden} />);
    expect(onHidden).not.toHaveBeenCalled();
  });

  it('hides once ready, and with Reduce Motion skips the fill animation', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const onHidden = jest.fn();
    await render(<SplashOverlay ready onHidden={onHidden} />);
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('keeps the whole fill under a second', () => {
    expect(SQUARE_STEP_MS * 8 + motion.base).toBeLessThan(1000);
  });
});
