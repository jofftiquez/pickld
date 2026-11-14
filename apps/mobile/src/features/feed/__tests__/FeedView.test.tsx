import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FeedAuthor, FeedJar } from '../feedModel';
import { FeedView, type FeedViewProps } from '../FeedView';

// Reanimated needs native worklets; JarGraphic only uses it to animate a new layer.
jest.mock('react-native-reanimated', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent:
        (C: React.ComponentType<Record<string, unknown>>) =>
        ({ animatedProps, ...rest }: { animatedProps: object }) =>
          createElement(C, { ...rest, ...animatedProps }),
    },
    Easing: { out: () => 'easeOut', cubic: 'cubic' },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedProps: (fn: () => object) => fn(),
    withTiming: (to: number) => to,
  };
});

const NOW = new Date('2026-11-10T12:00:00Z');

const mika: FeedJar = {
  jar_id: 'jar-mika',
  author_id: 'mika-id',
  author_username: 'mika',
  author_display_name: 'Mika Reyes',
  author_avatar_path: null,
  local_date: '2026-11-10',
  feed_at: '2026-11-10T10:00:00Z',
  visible_count: 6,
  like_count: 21,
  comment_count: 3,
  preview_moment_ids: ['m1', 'm2', 'm3', 'm4'],
  previewUrls: ['u1', 'u2', 'u3', 'u4'],
  last_caption: 'Monday, but make it slow',
  is_new: true,
};

const authors: FeedAuthor[] = [
  { author_id: 'mika-id', username: 'mika', display_name: 'Mika Reyes', avatar_path: null, has_new: true },
  { author_id: 'lola-id', username: 'lola', display_name: 'Lola Cruz', avatar_path: null, has_new: false },
];

async function setup(props: Partial<FeedViewProps> = {}) {
  const handlers = {
    onRefresh: jest.fn(),
    onEndReached: jest.fn(),
    onOpenNotifications: jest.fn(),
    onOpenDiscover: jest.fn(),
    onFindPeople: jest.fn(),
    onInvite: jest.fn(),
  };
  await render(
    <FeedView
      jars={[mika]}
      authors={authors}
      myName="Dale Santos"
      now={NOW}
      insets={{ top: 0, bottom: 0 }}
      isLoading={false}
      isRefreshing={false}
      isFetchingNextPage={false}
      hasUnread={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('FeedView', () => {
  it('shows a card with the author, age, count, mosaic, likes, comments and caption (design: Feed)', async () => {
    await setup();
    expect(screen.getByText('Mika Reyes')).toBeTruthy();
    expect(screen.getByText('Updated 2h ago')).toBeTruthy();
    expect(screen.getByText('6/8')).toBeTruthy();
    expect(screen.getByText('+2', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getAllByTestId('feed-mosaic-small', { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.getByText('21')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('“Monday, but make it slow”')).toBeTruthy();
    expect(
      screen.getByLabelText('Mika Reyes’s jar, 6 of 8 moments. Updated 2h ago. 21 likes, 3 comments'),
    ).toBeTruthy();
  });

  it('lists "You" first, then authors with a green ring when they have a new jar', async () => {
    await setup();
    expect(screen.getByTestId('feed-author-me-seen')).toBeTruthy();
    expect(screen.getByTestId('feed-author-mika-new')).toBeTruthy();
    expect(screen.getByTestId('feed-author-lola-seen')).toBeTruthy();
    expect(screen.getByLabelText('Mika Reyes, new jar')).toBeTruthy();
    expect(screen.getByText('Mika')).toBeTruthy();
  });

  it('shows the unread dot only with unread notifications', async () => {
    await setup();
    expect(screen.queryByTestId('feed-notifications-dot')).toBeNull();
    await screen.unmount();
    const { onOpenNotifications } = await setup({ hasUnread: true });
    expect(screen.getByTestId('feed-notifications-dot')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Notifications, unread'));
    expect(onOpenNotifications).toHaveBeenCalled();
  });

  it('the compass next to the bell opens Discover (D-101)', async () => {
    const h = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Discover' }));
    expect(h.onOpenDiscover).toHaveBeenCalled();
  });

  it('opens the jar when a card is pressed', async () => {
    const onOpenJar = jest.fn();
    await setup({ onOpenJar });
    await fireEvent.press(screen.getByTestId('feed-card-mika'));
    expect(onOpenJar).toHaveBeenCalledWith('jar-mika');
  });

  it('shows a spinner while the first page loads', async () => {
    await setup({ jars: undefined, isLoading: true });
    expect(screen.getByTestId('feed-loading')).toBeTruthy();
  });

  it('shows "Your feed is quiet" with Find people and Invite friends when the user reads nobody', async () => {
    const { onFindPeople, onInvite } = await setup({ jars: [], authors: [] });
    expect(screen.getByText('Your feed is quiet')).toBeTruthy();
    expect(screen.queryByTestId('feed-authors')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Find people'));
    expect(onFindPeople).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Invite friends'));
    expect(onInvite).toHaveBeenCalled();
  });

  it('keeps the empty state hidden while the authors load; reading someone with no jars shows the quiet state', async () => {
    await setup({ jars: undefined, authors: undefined, isLoading: true });
    expect(screen.queryByTestId('feed-empty')).toBeNull();
    await screen.unmount();
    await setup({ jars: [], authors });
    expect(screen.queryByTestId('feed-empty')).toBeNull();
    expect(screen.getByTestId('feed-authors')).toBeTruthy();
    // Reading someone with no jars yet: the quiet state, inside the refreshable list (D-87).
    expect(screen.getByRole('header', { name: 'No jars yet' })).toBeTruthy();
    expect(screen.getByTestId('feed-quiet-refresh-hint')).toHaveTextContent('Pull down to refresh');
    expect(screen.getByRole('button', { name: 'Find more people' })).toBeTruthy();
  });

  it('reading nobody, lists the user’s own published jars under a Find people card, not the empty state (D-53)', async () => {
    const own: FeedJar = {
      ...mika,
      jar_id: 'jar-dale',
      author_id: 'dale-id',
      author_display_name: 'Dale Santos',
      is_new: false,
    };
    const { onFindPeople } = await setup({ jars: [own], authors: [] });
    expect(screen.queryByTestId('feed-empty')).toBeNull();
    expect(screen.getByTestId('feed-find-people-card')).toBeTruthy();
    expect(screen.getByText('Read a few friends’ days')).toBeTruthy();
    expect(screen.queryByText('Your feed is quiet')).toBeNull();
    expect(screen.getByText('Dale Santos')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Find people'));
    expect(onFindPeople).toHaveBeenCalled();
  });

  it('shows no Find people card once the user reads someone', async () => {
    await setup();
    expect(screen.queryByTestId('feed-find-people-card')).toBeNull();
  });
});
