import { fireEvent, render, screen } from '@testing-library/react-native';

import { FollowButton } from '../FollowButton';
import { expectMinTapArea, flatStyle } from '@/components/__tests__/testUtils';

describe('FollowButton', () => {
  it('says "Be a reader" and tells the screen reader whose reader (D-86)', async () => {
    const onPress = jest.fn();
    await render(<FollowButton action="read" name="Mika Reyes" onPress={onPress} />);
    const button = screen.getByRole('button', { name: "Be Mika Reyes's reader" });
    expect(screen.getByText('Be a reader')).toBeTruthy();
    expectMinTapArea(button);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('wraps a long label inside its parent instead of clipping it', async () => {
    await render(<FollowButton action="read" name="Mika Reyes" onPress={jest.fn()} />);
    expect(flatStyle(screen.getByRole('button')).maxWidth).toBe('100%');
    expect(screen.getByText('Be a reader').props.numberOfLines).toBeUndefined();
  });

  it('keeps Read back and Reading', async () => {
    await render(<FollowButton action="readBack" name="Jun" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Read back Jun' })).toHaveTextContent('Read back');
    await render(<FollowButton action="reading" name="Jun" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Reading Jun' })).toHaveTextContent('Reading');
  });
});
