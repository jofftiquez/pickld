import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FeedJar } from '@/features/feed/feedModel';
import type { FeedMoment } from '@/features/moments/momentsModel';

import { DiscoverView, type DiscoverViewProps } from '../DiscoverView';
import { mergeSuggestions, searchTerm, type Explore, type Person } from '../explore';
import { withoutAuthor } from '../useDiscover';

const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const person = (id: string, name: string, reading = false): Person => ({
  id,
  username: id,
  displayName: name,
  avatarUrl: null,
  reading,
});

describe('mergeSuggestions', () => {
  it('puts contacts first, then friends of friends; each person once, never one already read', () => {
    const out = mergeSuggestions(
      [person('ana', 'Ana'), person('ben', 'Ben', true)],
      [
        { ...person('cara', 'Cara'), mutualCount: 3 },
        { ...person('ana', 'Ana'), mutualCount: 2 },
        { ...person('ben', 'Ben'), mutualCount: 1 },
      ],
      new Set(),
    );
    expect(out.map((s) => [s.id, s.reason])).toEqual([
      ['ana', { kind: 'contact' }],
      ['cara', { kind: 'friends', count: 3 }],
      ['ben', { kind: 'friends', count: 1 }],
    ]);
  });

  it('says 8/8 today for someone with a full jar, and stops at the limit', () => {
    const out = mergeSuggestions(
      [],
      [
        { ...person('a', 'A'), mutualCount: 5 },
        { ...person('b', 'B'), mutualCount: 4 },
        { ...person('c', 'C'), mutualCount: 3 },
      ],
      new Set(['b']),
      2,
    );
    expect(out.map((s) => [s.id, s.reason.kind])).toEqual([
      ['a', 'friends'],
      ['b', 'fullToday'],
    ]);
  });
});

describe('searchTerm', () => {
  it('needs two characters after an optional @', () => {
    expect(searchTerm(' m ')).toBeNull();
    expect(searchTerm('@m')).toBeNull();
    expect(searchTerm('@ma')).toBe('@ma');
    expect(searchTerm(' maria ')).toBe('maria');
  });
});

const NOW = new Date('2026-11-10T12:00:00Z');

const DATA: Explore = {
  suggestions: [
    { ...person('aya', 'Aya Lim'), reason: { kind: 'fullToday' } },
    { ...person('jun', 'Jun Santos'), reason: { kind: 'friends', count: 4 } },
    { ...person('lola', 'Lola Cora'), reason: { kind: 'contact' } },
  ],
};

const MOMENT: FeedMoment = {
  moment_id: 'm1',
  jar_id: 'jar-rio',
  author_id: 'rio-id',
  author_username: 'rio',
  author_display_name: 'Rio Tan',
  author_avatar_path: null,
  slot: 'ootd',
  caption: 'Market day.',
  captured_at: '2026-11-09T23:30:00Z',
  added_at: '2026-11-09T23:30:00Z',
  is_backfilled: false,
  visibility: 'everyone',
  edits: {},
  like_count: 2,
  liked: false,
  comment_count: 1,
  jar_tz: 'Asia/Manila',
  jar_local_date: '2026-11-10',
  jar_visible: true,
  fullUrl: null,
  thumbUrl: null,
};

const JAR: FeedJar = {
  jar_id: 'jar-bea',
  author_id: 'bea-id',
  author_username: 'bea',
  author_display_name: 'Bea Cruz',
  author_avatar_path: null,
  local_date: '2026-11-10',
  feed_at: '2026-11-10T10:00:00Z',
  visible_count: 3,
  like_count: 5,
  comment_count: 0,
  preview_moment_ids: ['p1', 'p2', 'p3'],
  previewUrls: [null, null, null],
  last_caption: null,
  is_new: false,
};

async function renderDiscover(props: Partial<DiscoverViewProps> = {}) {
  const handlers = {
    onQueryChange: jest.fn(),
    onTabChange: jest.fn(),
    onRefresh: jest.fn(),
    onEndReached: jest.fn(),
    onRetry: jest.fn(),
    onRetryList: jest.fn(),
    onOpenProfile: jest.fn(),
    onSetReading: jest.fn(),
    onReadAuthor: jest.fn(),
    onOpenMoment: jest.fn(),
    onToggleLike: jest.fn(),
    onOpenJar: jest.fn(),
  };
  await render(
    <DiscoverView
      data={DATA}
      insets={insets}
      query=""
      results={undefined}
      searching={false}
      tab="moments"
      moments={[MOMENT]}
      jars={[JAR]}
      listLoading={false}
      listFailed={false}
      isRefreshing={false}
      isFetchingNextPage={false}
      viewerId="me-id"
      now={NOW}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('DiscoverView', () => {
  it('is titled Discover, with suggested authors and why; Be a reader reads them', async () => {
    const h = await renderDiscover();
    expect(screen.getByRole('header', { name: 'Discover' })).toBeTruthy();
    expect(screen.getByText('8/8 today')).toBeTruthy();
    expect(screen.getByText('Read by 4 friends')).toBeTruthy();
    expect(screen.getByText('In your contacts')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('explore-author-jun-read'));
    expect(h.onSetReading).toHaveBeenCalledWith(expect.objectContaining({ id: 'jun' }), true);
  });

  it('lists moments under the Moments | Jars switch; a card opens its thread, Be a reader (not Go to jar) reads its author', async () => {
    const h = await renderDiscover();
    expect(screen.getByRole('tab', { name: 'Moments', selected: true })).toBeTruthy();
    expect(screen.getByTestId('moments-card-m1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('moments-open-m1'));
    expect(h.onOpenMoment).toHaveBeenCalledWith(MOMENT);
    // Be a reader takes Go to jar's place in the card's header (design: Explore).
    expect(screen.queryByTestId('moments-jar-m1')).toBeNull();
    await fireEvent.press(screen.getByTestId('moments-read-m1'));
    expect(h.onReadAuthor).toHaveBeenCalledWith('rio-id');
    await fireEvent.press(screen.getByTestId('moments-like-m1'));
    expect(h.onToggleLike).toHaveBeenCalledWith(MOMENT);
    await fireEvent.press(screen.getByRole('tab', { name: 'Jars' }));
    expect(h.onTabChange).toHaveBeenCalledWith('jars');
  });

  it('lists jars on the Jars tab; a card opens the jar, Be a reader reads its author', async () => {
    const h = await renderDiscover({ tab: 'jars' });
    expect(screen.queryByTestId('moments-card-m1')).toBeNull();
    await fireEvent.press(screen.getByTestId('feed-card-bea-open'));
    expect(h.onOpenJar).toHaveBeenCalledWith('jar-bea');
    await fireEvent.press(screen.getByTestId('feed-card-bea-read'));
    expect(h.onReadAuthor).toHaveBeenCalledWith('bea-id');
  });

  it('says when there is nothing to discover, with the pull hint', async () => {
    await renderDiscover({ moments: [] });
    expect(screen.getByText('Nothing to discover yet')).toBeTruthy();
    expect(screen.getByText('Pull down to refresh')).toBeTruthy();
  });

  it('shows loading, then a retry when the list fails', async () => {
    await renderDiscover({ moments: undefined, listLoading: true });
    expect(screen.getByTestId('discover-loading')).toBeTruthy();
    await screen.unmount();
    const h = await renderDiscover({ moments: undefined, listFailed: true });
    await fireEvent.press(screen.getByTestId('discover-retry'));
    expect(h.onRetryList).toHaveBeenCalled();
  });

  it('replaces everything below search with results while searching; Reading stops reading', async () => {
    const h = await renderDiscover({
      query: 'ma',
      searching: true,
      results: [person('maria', 'Maria Santos', true), person('marco', 'Marco Reyes')],
    });
    expect(screen.queryByText('Suggested authors')).toBeNull();
    expect(screen.queryByTestId('discover-tabs')).toBeNull();
    expect(screen.queryByTestId('moments-card-m1')).toBeNull();
    await fireEvent.press(screen.getByTestId('explore-result-maria-button'));
    expect(h.onSetReading).toHaveBeenCalledWith(expect.objectContaining({ id: 'maria' }), false);
    await fireEvent.press(screen.getByTestId('explore-result-marco-button'));
    expect(h.onSetReading).toHaveBeenCalledWith(expect.objectContaining({ id: 'marco' }), true);
  });

  it('says when nobody matches', async () => {
    await renderDiscover({ query: 'zzz', searching: true, results: [] });
    expect(screen.getByText('No one matches that name.')).toBeTruthy();
  });
});

describe('withoutAuthor', () => {
  it('takes an author read from Discover out of every page', () => {
    const pages = [
      { moments: [MOMENT, { ...MOMENT, moment_id: 'm2', author_id: 'kit-id' }], nextCursor: null },
      { moments: [{ ...MOMENT, moment_id: 'm3' }], nextCursor: null },
    ];
    expect(withoutAuthor(pages, 'rio-id').map((p) => p.moments.map((m) => m.moment_id))).toEqual([['m2'], []]);
    expect(withoutAuthor([{ jars: [JAR], nextCursor: null }], 'bea-id')[0]?.jars).toEqual([]);
  });
});
