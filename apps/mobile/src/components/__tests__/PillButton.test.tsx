import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PillButton } from '../PillButton';
import { colors, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

describe('PillButton', () => {
  it('is 36 px tall with a tap area extended to 44 by hitSlop', async () => {
    await render(<PillButton label="Read" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Read' });
    expect(flatStyle(button).minHeight).toBe(sizes.pillButton);
    expect(button.props.hitSlop).toMatchObject({ top: 4, bottom: 4 });
    expectMinTapArea(button);
  });

  it('renders primary and subtle variants', async () => {
    await render(<PillButton label="Read back" onPress={jest.fn()} />);
    expect(flatStyle(screen.getByRole('button')).backgroundColor).toBe(colors.brand);
    expect(StyleSheet.flatten(screen.getByText('Read back').props.style).color).toBe(colors.surface);
    await render(<PillButton label="Reading" variant="subtle" onPress={jest.fn()} />);
    expect(flatStyle(screen.getByRole('button')).backgroundColor).toBe(colors.subtle);
    expect(StyleSheet.flatten(screen.getByText('Reading').props.style).color).toBe(colors.ink);
  });

  it('hugs its label instead of stretching', async () => {
    await render(<PillButton label="Copy" onPress={jest.fn()} />);
    expect(flatStyle(screen.getByRole('button')).alignSelf).toBe('flex-start');
  });

  it('announces and enforces disabled', async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Allow" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Allow' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
