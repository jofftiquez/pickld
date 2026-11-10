import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DangerButton } from '../DangerButton';
import { colors, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

describe('DangerButton', () => {
  it('is a red button with bold white text', async () => {
    const onPress = jest.fn();
    await render(<DangerButton label="Delete my account" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Delete my account' });
    expect(flatStyle(button)).toMatchObject({ backgroundColor: colors.danger, minHeight: sizes.buttonPrimary });
    const text = StyleSheet.flatten(screen.getByText('Delete my account').props.style);
    expect(text).toMatchObject({ color: colors.surface, fontFamily: 'PlusJakartaSans_800ExtraBold' });
    expectMinTapArea(button);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });

  it('announces disabled', async () => {
    await render(<DangerButton label="Block" onPress={jest.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Block' }).props.accessibilityState).toMatchObject({ disabled: true });
  });
});
