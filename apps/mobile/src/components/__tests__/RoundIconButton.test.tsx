import { fireEvent, render, screen } from '@testing-library/react-native';

import { RoundIconButton } from '../RoundIconButton';
import { colors, radius, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

describe('RoundIconButton', () => {
  it('light: 44 px white circle with an ink icon and a spoken name', async () => {
    const onPress = jest.fn();
    await render(<RoundIconButton icon="back" accessibilityLabel="Back" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Back' });
    expect(flatStyle(button)).toMatchObject({
      width: sizes.roundButton,
      height: sizes.roundButton,
      backgroundColor: colors.surface,
    });
    expect(screen.getByTestId('icon-back', { includeHiddenElements: true }).props.stroke).toBe(colors.ink);
    expect(screen.queryByTestId('glass-blur')).toBeNull();
    expectMinTapArea(button);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });

  it('glass: frosted blur with a white icon for use over photos', async () => {
    await render(<RoundIconButton icon="close" variant="glass" accessibilityLabel="Close" onPress={jest.fn()} />);
    expect(flatStyle(screen.getByRole('button', { name: 'Close' }))).toMatchObject({
      width: sizes.roundButton,
      height: sizes.roundButton,
    });
    // Below iOS 26 (the tests' default) the surface is today's dark blur (D-57).
    expect(flatStyle(screen.getByTestId('glass'))).toMatchObject({
      backgroundColor: colors.glass,
      borderRadius: radius.pill,
    });
    expect(screen.getByTestId('glass-blur')).toBeTruthy();
    expect(screen.getByTestId('icon-close', { includeHiddenElements: true }).props.stroke).toBe(colors.surface);
  });

  it('announces and enforces disabled', async () => {
    const onPress = jest.fn();
    await render(<RoundIconButton icon="more" accessibilityLabel="More options" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'More options' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
