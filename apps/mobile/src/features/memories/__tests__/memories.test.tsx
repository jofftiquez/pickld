import { fireEvent, render, screen } from '@testing-library/react-native';

import { previousMonth, yearsBetween, type Memories } from '../memories';
import { MemoriesView, type MemoriesViewProps } from '../MemoriesView';

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

const DATA: Memories = {
  onThisDay: {
    jarId: 'jar-2025',
    localDate: '2025-11-10',
    momentCount: 7,
    yearsAgo: 1,
    coverMomentId: 'm-cover',
    photoUrl: 'https://photos.example/cover.webp',
  },
  recap: {
    month: '2026-10',
    momentCount: 212,
    fullDays: 27,
    topSlot: 'selfie',
    photos: [
      { momentId: 'm1', jarId: 'j1', slot: 'ootd', thumbUrl: 'https://photos.example/1.webp' },
      { momentId: 'm2', jarId: 'j2', slot: 'selfie', thumbUrl: null },
    ],
  },
  year: { year: 2026, jarsFilled: 128, fullDays: 40, momentCount: 700 },
};

async function renderMemories(props: Partial<MemoriesViewProps> = {}) {
  const handlers = {
    onBack: jest.fn(),
    onRetry: jest.fn(),
    onOpenJar: jest.fn(),
    onOpenPhoto: jest.fn(),
    onYear: jest.fn(),
  };
  await render(<MemoriesView data={DATA} insets={insets} locale="en-US" {...handlers} {...props} />);
  return handlers;
}

describe('Memories helpers', () => {
  it('recaps the month before today, across a new year', () => {
    expect(previousMonth('2026-11-10')).toBe('2026-10');
    expect(previousMonth('2027-01-03')).toBe('2026-12');
  });
  it('counts years between same-day dates', () => {
    expect(yearsBetween('2024-11-10', '2026-11-10')).toBe(2);
  });
});

describe('MemoriesView', () => {
  it('shows On this day with its date, weekday and count, and opens its jar', async () => {
    const h = await renderMemories();
    expect(screen.getByText('Nov 10, 2025 · one year ago')).toBeTruthy();
    expect(screen.getByText('Your Monday')).toBeTruthy();
    expect(screen.getByText('7 of 8 moments')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('memories-on-this-day'));
    expect(h.onOpenJar).toHaveBeenCalledWith('jar-2025');
  });

  it('recap shows moments, full days and the top tag, with its photos', async () => {
    const h = await renderMemories();
    expect(screen.getByText('October recap')).toBeTruthy();
    expect(screen.getByText('212 moments · 27 full days · top tag #selfie')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('memories-photo-m2'));
    expect(h.onOpenPhoto).toHaveBeenCalledWith(DATA.recap.photos[1]);
    await fireEvent.press(screen.getByTestId('memories-play'));
    expect(h.onOpenPhoto).toHaveBeenLastCalledWith(DATA.recap.photos[0]);
  });

  it('says so for an empty month and hides Play and the On this day card when there is nothing', async () => {
    await renderMemories({
      data: {
        ...DATA,
        onThisDay: null,
        recap: { month: '2026-10', momentCount: 0, fullDays: 0, topSlot: null, photos: [] },
      },
    });
    expect(screen.getByText('No moments in October.')).toBeTruthy();
    expect(screen.queryByTestId('memories-play')).toBeNull();
    expect(screen.queryByTestId('memories-on-this-day')).toBeNull();
  });

  it('shows the year so far', async () => {
    const h = await renderMemories();
    expect(screen.getByText('Your 2026 so far')).toBeTruthy();
    expect(screen.getByText('128 jars filled. Turn them into a year book later.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('memories-year'));
    expect(h.onYear).toHaveBeenCalled();
  });

  it('offers a retry when loading failed', async () => {
    const h = await renderMemories({ data: undefined, failed: true });
    await fireEvent.press(screen.getByTestId('memories-retry'));
    expect(h.onRetry).toHaveBeenCalled();
  });
});
