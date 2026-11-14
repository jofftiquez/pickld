import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';

import { ThumbButton } from '../ThumbButton';

// Thumbs up on Pack preview (FR-STK-07): the like pill's behavior (D-58). A new thumb pops in with a light
// haptic; taking it back has no haptic; with Reduce Motion it fades instead of growing.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('@/features/edit/__tests__/reanimatedStandIn'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
}));

beforeEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.mocked(Haptics.impactAsync).mockClear();
});

it('gives a thumb with a light haptic and takes it back without one', async () => {
  const onPress = jest.fn();
  const view = await render(<ThumbButton count={4} thumbed={false} onPress={onPress} />);
  const button = screen.getByRole('button');
  expect(button.props.accessibilityLabel).toBe('4 thumbs up');
  expect(button.props.accessibilityHint).toBe('Gives this pack a thumbs up');
  await fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

  await view.rerender(<ThumbButton count={5} thumbed onPress={onPress} />);
  expect(screen.getByText('5')).toBeTruthy();
  expect(screen.getByRole('button').props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByTestId('thumb-icon-pop')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(2);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});

it('fades the thumb in with Reduce Motion', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  await render(<ThumbButton count={1} thumbed onPress={jest.fn()} />);
  expect(screen.getByTestId('thumb-icon-fade')).toBeTruthy();
  expect(screen.queryByTestId('thumb-icon-pop')).toBeNull();
});
