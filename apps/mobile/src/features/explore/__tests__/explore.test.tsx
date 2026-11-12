import { fireEvent, render, screen } from '@testing-library/react-native';

import { mergeSuggestions, searchTerm, type Explore, type Person } from '../explore';
import { ExploreView, type ExploreViewProps } from '../ExploreView';

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

const DATA: Explore = {
  suggestions: [
    { ...person('aya', 'Aya Lim'), reason: { kind: 'fullToday' } },
    { ...person('jun', 'Jun Santos'), reason: { kind: 'friends', count: 4 } },
    { ...person('lola', 'Lola Cora'), reason: { kind: 'contact' } },
  ],
  fullJars: [{ jarId: 'jar-1', userId: 'aya', username: 'aya', displayName: 'Aya Lim', coverUrl: null }],
};

async function renderExplore(props: Partial<ExploreViewProps> = {}) {
  const handlers = {
    onQueryChange: jest.fn(),
    onBack: jest.fn(),
    onRetry: jest.fn(),
    onOpenProfile: jest.fn(),
    onSetReading: jest.fn(),
    onOpenJar: jest.fn(),
  };
  await render(
    <ExploreView data={DATA} insets={insets} query="" results={undefined} searching={false} {...handlers} {...props} />,
  );
  return handlers;
}

describe('ExploreView', () => {
  it('shows suggested authors with why, and Read reads them', async () => {
    const h = await renderExplore();
    expect(screen.getByText('8/8 today')).toBeTruthy();
    expect(screen.getByText('Read by 4 friends')).toBeTruthy();
    expect(screen.getByText('In your contacts')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('explore-author-jun-read'));
    expect(h.onSetReading).toHaveBeenCalledWith(expect.objectContaining({ id: 'jun' }), true);
  });

  it('labels a full jar with the first name and opens it', async () => {
    const h = await renderExplore();
    expect(screen.getByText('Aya')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Aya Lim’s full jar today'));
    expect(h.onOpenJar).toHaveBeenCalledWith('jar-1');
  });

  it('replaces the sections with results while searching; Reading stops reading', async () => {
    const h = await renderExplore({
      query: 'ma',
      searching: true,
      results: [person('maria', 'Maria Santos', true), person('marco', 'Marco Reyes')],
    });
    expect(screen.queryByText('Suggested authors')).toBeNull();
    await fireEvent.press(screen.getByTestId('explore-result-maria-button'));
    expect(h.onSetReading).toHaveBeenCalledWith(expect.objectContaining({ id: 'maria' }), false);
    await fireEvent.press(screen.getByTestId('explore-result-marco-button'));
    expect(h.onSetReading).toHaveBeenCalledWith(expect.objectContaining({ id: 'marco' }), true);
  });

  it('says when nobody matches', async () => {
    await renderExplore({ query: 'zzz', searching: true, results: [] });
    expect(screen.getByText('No one matches that name.')).toBeTruthy();
  });
});
