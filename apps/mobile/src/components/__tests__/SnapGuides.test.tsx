import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useReducedMotion, withTiming, type SharedValue } from 'react-native-reanimated';

import { SnapGuides } from '../SnapGuides';
import { colors, motion, sizes } from '@/theme/tokens';

// The shared stand-in (shared values are boxes, animated styles computed on render), with Reduce Motion and
// withTiming as spies so the fade can be told apart from a plain show and hide.
jest.mock('react-native-reanimated', () => {
  const standIn = jest.requireActual('@/features/edit/__tests__/reanimatedStandIn');
  return {
    ...standIn,
    __esModule: true,
    useReducedMotion: jest.fn(() => false),
    withTiming: jest.fn((to: number) => to),
  };
});

const line = (axis: 'vertical' | 'horizontal') =>
  StyleSheet.flatten(screen.getByTestId(`guides-${axis}`, { includeHiddenElements: true }).props.style);

// Centre snap guides (D-158), shared by Crop's Fit and the editor's overlays.
describe('SnapGuides', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
    jest.mocked(withTiming).mockClear();
  });

  it('shows the line for each snapped axis, thin, centred and full length, fading quickly', async () => {
    await render(<SnapGuides vertical horizontal={false} testID="guides" />);
    expect(line('vertical')).toMatchObject({
      opacity: 1,
      top: 0,
      bottom: 0,
      left: '50%',
      width: sizes.snapGuideWidth,
      backgroundColor: colors.snapGuide,
    });
    expect(line('horizontal')).toMatchObject({ opacity: 0, left: 0, right: 0, top: '50%' });
    expect(withTiming).toHaveBeenCalledWith(1, { duration: motion.fast });
  });

  it('reads shared values, as the editor passes them from its gesture worklets', async () => {
    const box = (value: boolean) => ({ value, get: () => value, set: () => {} }) as unknown as SharedValue<boolean>;
    await render(<SnapGuides vertical={box(false)} horizontal={box(true)} testID="guides" />);
    expect(line('vertical').opacity).toBe(0);
    expect(line('horizontal').opacity).toBe(1);
  });

  it('with Reduce Motion it just shows and hides: no fade', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await render(<SnapGuides vertical horizontal testID="guides" />);
    expect(line('vertical').opacity).toBe(1);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('is decorative and lets touches through', async () => {
    await render(<SnapGuides vertical horizontal testID="guides" />);
    const root = screen.getByTestId('guides', { includeHiddenElements: true });
    expect(root.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    // Hidden from screen readers: not found without asking for hidden elements.
    expect(screen.queryByTestId('guides-vertical')).toBeNull();
  });
});
