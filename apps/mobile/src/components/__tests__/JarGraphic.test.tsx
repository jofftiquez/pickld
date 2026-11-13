import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import { JarGraphic, layerY } from '../JarGraphic';
import { colors, lidColors, motion } from '@/theme/tokens';
import { flatStyle } from './testUtils';

// Minimal Reanimated stand-in: animations land at once, and withTiming records how it was asked to animate.
jest.mock('react-native-reanimated', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent:
        (C: React.ComponentType<Record<string, unknown>>) =>
        ({ animatedProps, ...rest }: { animatedProps: object }) =>
          createElement(C, { ...rest, ...animatedProps }),
    },
    Easing: { out: () => 'easeOut', cubic: 'cubic' },
    useReducedMotion: jest.fn(() => false),
    useSharedValue: (value: number) => ({ value }),
    useAnimatedProps: (fn: () => object) => fn(),
    withTiming: jest.fn((to: number) => to),
  };
});

const layers = () => screen.queryAllByTestId('jar-layer');
// react-native-svg hands fills to native code as { type: 0, payload: <ARGB number> }.
const fillOf = (el: ReturnType<typeof screen.getByTestId>) => (el.props.fill as { payload: number }).payload;

describe('JarGraphic', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
    jest.mocked(withTiming).mockClear();
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('draws %i layers and announces "%i of 8 moments"', async (count) => {
    await render(<JarGraphic count={count} />);
    expect(layers()).toHaveLength(count);
    expect(screen.getByLabelText(`${count} of 8 moments`)).toBeTruthy();
  });

  it('stacks layers bottom-up, alternating brand and brandLayer from the bottom', async () => {
    await render(<JarGraphic count={3} />);
    expect(layers().map((l) => [Number(l.props.y), fillOf(l)])).toEqual([
      [layerY(0), processColor(colors.brand)],
      [layerY(1), processColor(colors.brandLayer)],
      [layerY(2), processColor(colors.brand)],
    ]);
    expect(layerY(7)).toBeGreaterThan(15); // the top layer stays inside the glass body (y 15)
  });

  it('clamps counts outside 0–8', async () => {
    await render(<JarGraphic count={12} />);
    expect(layers()).toHaveLength(8);
    expect(screen.getByLabelText('8 of 8 moments')).toBeTruthy();
  });

  it.each([
    [14, 17.5],
    [22, 27.5],
    [52, 65],
  ])('renders %ipx wide at the jar shape (%ipx tall)', async (size, height) => {
    await render(<JarGraphic count={4} size={size} testID="jar" />);
    expect(flatStyle(screen.getByTestId('jar'))).toMatchObject({ width: size, height });
  });

  it('paints the lid in the chosen color', async () => {
    await render(<JarGraphic count={2} lidColor={lidColors.ube} />);
    expect(fillOf(screen.getByTestId('jar-lid'))).toBe(processColor(lidColors.ube));
  });

  it('can be hidden from screen readers', async () => {
    await render(<JarGraphic count={2} decorative />);
    expect(screen.queryByLabelText('2 of 8 moments')).toBeNull();
  });

  it('does not animate on first render', async () => {
    await render(<JarGraphic count={5} />);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('settles a newly added layer', async () => {
    const view = await render(<JarGraphic count={2} />);
    await view.rerender(<JarGraphic count={3} />);
    expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: motion.jarLayerSettle }));
  });

  it('fades the new layer in place with Reduce Motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const view = await render(<JarGraphic count={2} />);
    await view.rerender(<JarGraphic count={3} />);
    expect(withTiming).toHaveBeenCalledWith(1, { duration: motion.base });
    expect(withTiming).not.toHaveBeenCalledWith(1, expect.objectContaining({ duration: motion.jarLayerSettle }));
  });

  it('closes the lid when the day is published (D-58)', async () => {
    const view = await render(<JarGraphic count={3} />);
    expect(withTiming).not.toHaveBeenCalled();
    await view.rerender(<JarGraphic count={3} closeLid />);
    expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: motion.celebrationPop }));
    // It starts above the jar and drops shut.
    expect(screen.getByTestId('jar-lid').props.y).toBeLessThan(2);
  });

  it('fades the lid in place with Reduce Motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const view = await render(<JarGraphic count={3} />);
    await view.rerender(<JarGraphic count={3} closeLid />);
    expect(withTiming).toHaveBeenCalledWith(1, { duration: motion.base });
    expect(withTiming).not.toHaveBeenCalledWith(1, expect.objectContaining({ duration: motion.celebrationPop }));
    // It never moves.
    expect(screen.getByTestId('jar-lid').props.y).toBe(2);
  });

  it('does not animate when a layer is removed', async () => {
    const view = await render(<JarGraphic count={3} />);
    await view.rerender(<JarGraphic count={2} />);
    expect(withTiming).not.toHaveBeenCalled();
  });
});
