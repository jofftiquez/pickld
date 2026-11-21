import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { WaitingView } from '../WaitingView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

describe('Waiting', () => {
  it('closes the keyboard once the whole code is typed, so Get in is in view', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const onChangeCode = jest.fn();
    await render(
      <WaitingView
        insets={insets}
        ahead={null}
        endsAt={null}
        code=""
        onChangeCode={onChangeCode}
        error={null}
        busy={false}
        onPaste={jest.fn()}
        onScan={jest.fn()}
        onGetIn={jest.fn()}
        onSettings={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getByTestId('waiting-code'), 'k7mab');
    expect(dismiss).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('waiting-code'), 'k7mabc');
    expect(onChangeCode.mock.calls).toEqual([['K7MAB'], ['K7MABC']]);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
