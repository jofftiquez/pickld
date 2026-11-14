import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ProfileRow } from '../profileModel';
import { ReadersView, type ReadersViewProps } from '../ReadersView';
import type { FollowListRow } from '../useFollowList';

// Reanimated needs native worklets; Dialog only uses it for its entrance.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (C: unknown) => C },
    FadeIn: { duration: () => undefined },
    FadeOut: { duration: () => undefined },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (to: number) => to,
  };
});

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

const dale: ProfileRow = {
  id: 'dale-id',
  username: 'dale',
  display_name: 'Dale Santos',
  bio: null,
  lid_color: '#7fad33',
  reader_count: 1,
  author_count: 1250,
  jar_count: 3,
};

function row(username: string, over: Partial<FollowListRow> = {}): FollowListRow {
  return {
    id: `${username}-id`,
    username,
    display_name: username[0]!.toUpperCase() + username.slice(1),
    avatar_path: null,
    is_following: false,
    follows_viewer: false,
    ...over,
  };
}

const rows = [
  row('mika', { is_following: true, follows_viewer: true }),
  row('jun', { follows_viewer: true }),
  row('lola'),
  row('dale', { id: 'dale-id' }),
];

async function renderView(props: Partial<ReadersViewProps>) {
  const handlers = {
    onBack: jest.fn(),
    onSelectList: jest.fn(),
    onChangeQuery: jest.fn(),
    onOpenProfile: jest.fn(),
    onToggleReading: jest.fn(),
    onRemoveReader: jest.fn(),
    onRetry: jest.fn(),
  };
  await render(
    <ReadersView
      profile={dale}
      viewerId="dale-id"
      list="readers"
      query=""
      rows={rows}
      insets={insets}
      locale="en-US"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('ReadersView', () => {
  it('shows counts on the switch and the right button per row, none on the viewer', async () => {
    await renderView({});
    expect(screen.getByText('1 Reader')).toBeTruthy();
    expect(screen.getByText('1.2k Authors')).toBeTruthy();
    expect(screen.getByTestId('follow-row-mika-button')).toHaveTextContent('Reading');
    expect(screen.getByTestId('follow-row-jun-button')).toHaveTextContent('Read back');
    expect(screen.getByTestId('follow-row-lola-button')).toHaveTextContent('Be a reader');
    expect(screen.queryByTestId('follow-row-dale-button')).toBeNull();
  });

  it('toggles reading and opens a profile', async () => {
    const { onToggleReading, onOpenProfile } = await renderView({});
    await fireEvent.press(screen.getByTestId('follow-row-jun-button'));
    expect(onToggleReading).toHaveBeenCalledWith(rows[1]);
    await fireEvent.press(screen.getByTestId('follow-row-lola-open'));
    expect(onOpenProfile).toHaveBeenCalledWith('lola');
  });

  it('lets the owner remove a reader after confirming', async () => {
    const { onRemoveReader } = await renderView({});
    await fireEvent(screen.getByTestId('follow-row-jun-open'), 'longPress');
    expect(onRemoveReader).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('readers-remove-confirm'));
    expect(onRemoveReader).toHaveBeenCalledWith(rows[1]);
  });

  it('offers no removal on the authors list or on someone else’s readers', async () => {
    await renderView({ list: 'authors' });
    expect(screen.getByTestId('follow-row-jun-open').props.accessibilityActions).toBeUndefined();
    await renderView({ viewerId: 'mika-id' });
    expect(screen.getByTestId('follow-row-jun-open').props.accessibilityActions).toBeUndefined();
    expect(screen.queryByText('Press and hold a reader to remove them.')).toBeNull();
  });

  it('says when a search matches nobody', async () => {
    await renderView({ query: 'zzz', rows: [] });
    expect(screen.getByTestId('readers-empty')).toHaveTextContent('No matchesNo one matches that search.');
  });

  it('your empty Authors list offers Find people; someone else’s does not (D-87)', async () => {
    const onFindPeople = jest.fn();
    await renderView({ list: 'authors', rows: [], onFindPeople });
    expect(screen.getByRole('header', { name: 'Not reading anyone yet' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Find people' }));
    expect(onFindPeople).toHaveBeenCalledTimes(1);
    await renderView({ list: 'authors', rows: [], onFindPeople, viewerId: 'mika-id' });
    expect(screen.queryByRole('button', { name: 'Find people' })).toBeNull();
  });
});
