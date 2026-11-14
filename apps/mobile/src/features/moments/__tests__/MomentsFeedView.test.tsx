import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FeedAuthor } from '@/features/feed/feedModel';

import type { FeedMoment } from '../momentsModel';
import { MomentsFeedView, type MomentsFeedViewProps } from '../MomentsFeedView';

const ME = 'me-id';

function moment(over: Partial<FeedMoment> & Pick<FeedMoment, 'moment_id'>): FeedMoment {
  return {
    jar_id: 'jar-mika',
    author_id: 'mika-id',
    author_username: 'mika',
    author_display_name: 'Mika Reyes',
    author_avatar_path: null,
    slot: 'ootd',
    caption: null,
    captured_at: '2026-11-08T23:30:00Z', // 7:30 AM on Mon, Nov 9 in Manila
    added_at: '2026-11-08T23:30:00Z',
    is_backfilled: false,
    visibility: 'readers',
    edits: {},
    like_count: 0,
    liked: false,
    comment_count: 0,
    jar_tz: 'Asia/Manila',
    jar_local_date: '2026-11-09',
    jar_visible: true,
    fullUrl: null,
    thumbUrl: null,
    ...over,
  };
}

const mika = moment({ moment_id: 'm1', caption: 'Green shirt day.', like_count: 4, liked: true, comment_count: 2 });
const mine = moment({
  moment_id: 'm2',
  author_id: ME,
  author_username: 'me',
  author_display_name: 'Dale Santos',
  slot: 'evening',
  visibility: 'only_me',
});
const authors: FeedAuthor[] = [
  { author_id: 'mika-id', username: 'mika', display_name: 'Mika Reyes', avatar_path: null, has_new: true },
];

async function setup(props: Partial<MomentsFeedViewProps> = {}) {
  const handlers = {
    onRefresh: jest.fn(),
    onEndReached: jest.fn(),
    onOpenNotifications: jest.fn(),
    onOpenDiscover: jest.fn(),
    onOpenJar: jest.fn(),
    onToggleLike: jest.fn(),
    onOpenComments: jest.fn(),
    onFindPeople: jest.fn(),
    onInvite: jest.fn(),
  };
  await render(
    <MomentsFeedView
      moments={[mika, mine]}
      authors={authors}
      viewerId={ME}
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

describe('MomentsFeedView', () => {
  it('shows the title and one card per moment with author, #slot, time and caption', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Moments' })).toBeTruthy();
    expect(screen.getByTestId('moments-card-m1')).toBeTruthy();
    expect(screen.getByTestId('moments-card-m2')).toBeTruthy();
    expect(screen.getByText('Mika Reyes')).toBeTruthy();
    expect(screen.getByText(/#ootd · 7:30/)).toBeTruthy();
    // The header reads the caption to screen readers, so the photo and caption below are hidden from them.
    expect(screen.getByText('Green shirt day.', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('moments-open-m1').props.accessibilityLabel).toMatch(
      /^Mika Reyes, #ootd, 7:30.*Green shirt day\.$/,
    );
  });

  it('marks only the viewer’s own Only me moment with a lock, and says so to screen readers', async () => {
    await setup();
    expect(screen.getAllByTestId('moments-private', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByTestId('moments-open-m2').props.accessibilityLabel).toMatch(/Only you can see it/);
    expect(screen.getByTestId('moments-open-m1').props.accessibilityLabel).not.toMatch(/Only you/);
  });

  it('opens the moment’s thread from the header, the photo and the comment pill (D-94)', async () => {
    const h = await setup();
    await fireEvent.press(screen.getByTestId('moments-open-m1'));
    await fireEvent.press(screen.getByTestId('moments-photo-m1', { includeHiddenElements: true }));
    expect(h.onOpenComments).toHaveBeenCalledTimes(2);
    expect(h.onOpenComments).toHaveBeenCalledWith(mika);
    expect(screen.getByTestId('moments-open-m1').props.accessibilityHint).toBe('Opens the moment’s comments');
  });

  it('Go to jar opens the moment’s jar, and only when the viewer may open it (D-94)', async () => {
    const hidden = moment({ moment_id: 'm3', jar_id: 'jar-hidden', jar_visible: false });
    const h = await setup({ moments: [mika, hidden] });
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Mika Reyes’s jar' }));
    expect(h.onOpenJar).toHaveBeenCalledWith(mika);
    expect(h.onOpenComments).not.toHaveBeenCalled();
    expect(screen.getByTestId('moments-jar-m1')).toBeTruthy();
    expect(screen.queryByTestId('moments-jar-m3')).toBeNull();
  });

  it('shows the author’s signed avatar, and initials without one (D-93)', async () => {
    await setup({ avatars: { 'mika-id': 'https://photos.test/a.jpg' } });
    expect(screen.getByText('DS', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('MR', { includeHiddenElements: true })).toBeNull();
  });

  it('likes it and opens its comments', async () => {
    const h = await setup();
    await fireEvent.press(screen.getByTestId('moments-like-m1'));
    expect(h.onToggleLike).toHaveBeenCalledWith(mika);
    await fireEvent.press(screen.getByTestId('moments-comments-m1'));
    expect(h.onOpenComments).toHaveBeenCalledWith(mika);
    expect(screen.getByTestId('moments-like-m1').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('moments-like-m1').props.accessibilityLabel).toMatch(/4/);
    expect(screen.getByTestId('moments-comments-m1').props.accessibilityLabel).toMatch(/2/);
  });

  it('reading nobody, the user’s own moments sit under a Find people card (D-53)', async () => {
    const h = await setup({ moments: [mine], authors: [] });
    expect(screen.getByTestId('feed-find-people-card')).toBeTruthy();
    expect(screen.getByText('Their moments will show up here with yours.')).toBeTruthy();
    expect(screen.getByTestId('moments-card-m2')).toBeTruthy();
    expect(screen.queryByTestId('feed-empty')).toBeNull();
    await fireEvent.press(screen.getByTestId('feed-find-people'));
    expect(h.onFindPeople).toHaveBeenCalled();
  });

  it('shows the empty view only when there is nothing at all', async () => {
    await setup({ moments: [], authors: [] });
    expect(screen.getByTestId('feed-empty')).toBeTruthy();
    expect(screen.getByText('No moments yet')).toBeTruthy();
    expect(screen.queryByTestId('feed-find-people-card')).toBeNull();
    // Inside the refreshable list, with the hint (D-87).
    expect(screen.getByTestId('feed-empty-refresh-hint')).toHaveTextContent('Pull down to refresh');
  });

  it('reading people with no moments yet shows the quiet state, and a spinner while loading', async () => {
    const h = await setup({ moments: [] });
    expect(screen.queryByTestId('feed-empty')).toBeNull();
    expect(screen.queryByTestId('feed-find-people-card')).toBeNull();
    expect(screen.getByRole('header', { name: 'Nothing new yet' })).toBeTruthy();
    expect(screen.getByText('When the people you read add moments, they show up here.')).toBeTruthy();
    expect(screen.getByTestId('moments-empty-refresh-hint')).toHaveTextContent('Pull down to refresh');
    await fireEvent.press(screen.getByRole('button', { name: 'Find more people' }));
    expect(h.onFindPeople).toHaveBeenCalled();
    await setup({ moments: undefined, authors: undefined, isLoading: true });
    expect(screen.getByTestId('moments-loading')).toBeTruthy();
    expect(screen.queryByTestId('feed-empty')).toBeNull();
  });

  it('the bell opens notifications and shows the unread dot', async () => {
    const h = await setup({ hasUnread: true });
    expect(screen.getByTestId('moments-notifications-dot')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Notifications, unread' }));
    expect(h.onOpenNotifications).toHaveBeenCalled();
  });

  it('the compass next to the bell opens Discover (D-101)', async () => {
    const h = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Discover' }));
    expect(h.onOpenDiscover).toHaveBeenCalled();
  });
});
