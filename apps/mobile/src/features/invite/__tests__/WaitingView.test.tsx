import { render } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { WaitingView, type WaitingViewProps } from '../WaitingView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

describe('Waiting', () => {
  it('scrolls Get in into view above the keyboard once the whole code is in', async () => {
    const props: WaitingViewProps = {
      insets,
      ahead: null,
      endsAt: null,
      code: '',
      onChangeCode: jest.fn(),
      error: null,
      busy: false,
      onPaste: jest.fn(),
      onScan: jest.fn(),
      onGetIn: jest.fn(),
      onSettings: jest.fn(),
    };
    const scrollToEnd = jest.spyOn(ScrollView.prototype as unknown as { scrollToEnd: () => void }, 'scrollToEnd');
    const view = await render(<WaitingView {...props} />);
    await view.rerender(<WaitingView {...props} code="K7MAB" />);
    expect(scrollToEnd).not.toHaveBeenCalled();
    await view.rerender(<WaitingView {...props} code="K7MABC" />);
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });
});
