import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FollowListRow } from '@/features/profile/useFollowList';

import { CloseFriendsView, type CloseFriendsViewProps } from '../CloseFriendsView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const row = (id: string, username: string, display_name: string): FollowListRow => ({
  id,
  username,
  display_name,
  avatar_path: null,
  is_following: true,
  follows_viewer: true,
  requested: false,
});
const mika = row('m', 'mika', 'Mika Santos');
const jo = row('j', 'jo.r', 'Jo Reyes');

async function setup(over: Partial<CloseFriendsViewProps> = {}) {
  const props: CloseFriendsViewProps = {
    rows: [mika, jo],
    ids: new Set(['m']),
    count: 1,
    query: '',
    onChangeQuery: jest.fn(),
    insets,
    onBack: jest.fn(),
    onToggle: jest.fn(),
    onRetry: jest.fn(),
    ...over,
  };
  await render(<CloseFriendsView {...props} />);
  return props;
}

describe('CloseFriendsView', () => {
  it('shows who is on the list and switches one reader on or off', async () => {
    const props = await setup();
    expect(screen.getByText('1 person on your list')).toBeTruthy();
    expect(screen.getByLabelText('Mika Santos on your Close friends list').props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(screen.getByLabelText('Jo Reyes on your Close friends list'));
    expect(props.onToggle).toHaveBeenCalledWith(jo, true);
    await fireEvent.press(screen.getByLabelText('Mika Santos on your Close friends list'));
    expect(props.onToggle).toHaveBeenCalledWith(mika, false);
  });

  it('says only readers can be close friends when nobody reads you', async () => {
    await setup({ rows: [], ids: new Set(), count: 0 });
    expect(screen.getByRole('header', { name: 'No readers yet' })).toBeTruthy();
  });

  it('says nobody matched a search, not that you have no readers', async () => {
    await setup({ rows: [], query: 'zz' });
    expect(screen.getByRole('header', { name: 'No one found' })).toBeTruthy();
  });
});
