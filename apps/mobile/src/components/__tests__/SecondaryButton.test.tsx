import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SecondaryButton } from '../SecondaryButton';
import { colors, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

describe('SecondaryButton', () => {
  it('renders the subtle variant with ink text at 50 px', async () => {
    await render(<SecondaryButton label="Cancel" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(flatStyle(button)).toMatchObject({ backgroundColor: colors.subtle, minHeight: sizes.buttonSecondary });
    expect(flatStyle(button).borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByText('Cancel').props.style).color).toBe(colors.ink);
    expectMinTapArea(button);
  });

  it('renders the outline variant with a border on white', async () => {
    await render(<SecondaryButton label="Continue with Apple" variant="outline" onPress={jest.fn()} />);
    const style = flatStyle(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(style).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.border });
    expect(style.borderWidth).toBeGreaterThan(0);
  });

  it('announces and enforces disabled', async () => {
    const onPress = jest.fn();
    await render(<SecondaryButton label="Cancel" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
