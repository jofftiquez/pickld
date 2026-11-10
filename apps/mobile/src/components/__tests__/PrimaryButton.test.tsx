import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY } from '../BaseButton';
import { PrimaryButton } from '../PrimaryButton';
import { colors, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

describe('PrimaryButton', () => {
  it('is a labelled brand button with bold white text of at least 14 px', async () => {
    await render(<PrimaryButton label="Publish jar" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Publish jar' });
    expect(flatStyle(button)).toMatchObject({ backgroundColor: colors.brand, minHeight: sizes.buttonPrimary });
    const text = StyleSheet.flatten(screen.getByText('Publish jar').props.style);
    expect(text.color).toBe(colors.surface);
    expect(text.fontFamily).toBe('PlusJakartaSans_800ExtraBold');
    expect(text.fontSize).toBeGreaterThanOrEqual(14);
    expectMinTapArea(button);
  });

  it('calls onPress and shows the pressed state', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Get started" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Get started' });
    expect(flatStyle(button).opacity).toBeUndefined();
    await fireEvent(button, 'pressIn');
    expect(flatStyle(screen.getByRole('button')).opacity).toBe(PRESSED_OPACITY);
    await fireEvent(button, 'pressOut');
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces and enforces the disabled state', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Publish jar" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Publish jar' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(flatStyle(button).opacity).toBe(DISABLED_OPACITY);
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses a separate accessibility label and hint when given, and hides the icon', async () => {
    await render(
      <PrimaryButton
        label="Next"
        accessibilityLabel="Next step"
        accessibilityHint="Opens Your day"
        icon="chevronRight"
        onPress={jest.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: 'Next step' });
    expect(button.props.accessibilityHint).toBe('Opens Your day');
    expect(
      screen.getByTestId('icon-chevronRight', { includeHiddenElements: true }).props.accessibilityElementsHidden,
    ).toBe(true);
  });
});
