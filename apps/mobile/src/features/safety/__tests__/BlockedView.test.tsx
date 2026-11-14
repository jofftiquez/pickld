import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BlockedAccount } from '../block';
import { BlockedView, type BlockedViewProps } from '../BlockedView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const kevin: BlockedAccount = {
  id: 'k',
  username: 'kev.r',
  display_name: 'Kevin Ramos',
  avatar_path: null,
  blocked_at: '2026-10-02T03:00:00Z',
};

async function setup(over: Partial<BlockedViewProps> = {}) {
  const props: BlockedViewProps = {
    rows: [kevin],
    insets,
    onBack: jest.fn(),
    onUnblock: jest.fn(),
    onRetry: jest.fn(),
    locale: 'en-US',
    ...over,
  };
  await render(<BlockedView {...props} />);
  return props;
}

describe('BlockedView', () => {
  it('lists who you blocked and when, and Unblock lifts that block', async () => {
    const props = await setup();
    expect(screen.getByText('@kev.r · blocked Oct 2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unblock Kevin Ramos'));
    expect(props.onUnblock).toHaveBeenCalledWith(kevin);
  });

  it('says so when nobody is blocked', async () => {
    await setup({ rows: [] });
    expect(screen.getByTestId('blocked-empty')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'You haven’t blocked anyone' })).toBeTruthy();
    expect(screen.getByText('If you block someone, they show up here, and you can unblock them anytime.')).toBeTruthy();
    // Not a pull-to-refresh list.
    expect(screen.queryByText('Pull down to refresh')).toBeNull();
  });
});
