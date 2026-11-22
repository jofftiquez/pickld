import { fireEvent, render, screen } from '@testing-library/react-native';

import { GuideView } from '../GuideView';

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

describe('How Pickld works (FR-ONB-10)', () => {
  it('page 1 has no Back; Next goes on and Done closes from any page', async () => {
    const onNext = jest.fn();
    const onDone = jest.fn();
    await render(<GuideView page={1} insets={insets} onBack={jest.fn()} onNext={onNext} onDone={onDone} />);
    expect(screen.queryByTestId('guide-back')).toBeNull();
    expect(screen.getByText('Your day, one jar')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guide-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('guide-done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('the last page says how Discover works and its main button closes instead of going on', async () => {
    const onNext = jest.fn();
    const onDone = jest.fn();
    await render(<GuideView page={5} insets={insets} onBack={jest.fn()} onNext={onNext} onDone={onDone} />);
    expect(screen.getByText('Discover through your people')).toBeTruthy();
    expect(screen.getByLabelText('Page 5 of 5')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guide-next'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});
