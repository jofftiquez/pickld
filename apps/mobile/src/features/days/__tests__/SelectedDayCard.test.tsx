import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildTodayGrid, type QueuedMoment, type ServerMoment } from '@/features/jar/todayGrid';
import type { Slot } from '@/theme/tokens';

import { SelectedDayCard } from '../SelectedDayCard';

// Reanimated can't load here (see TabShell.test.tsx), and the jar isn't under test.
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));

const DATE = '2026-11-07'; // a Saturday

function moment(slot: Slot, extra: Partial<ServerMoment> = {}): ServerMoment {
  return {
    id: `m-${slot}`,
    slot,
    status: 'live',
    visibility: 'readers',
    is_backfilled: false,
    captured_at: `${DATE}T08:00:00+08:00`,
    added_at: `${DATE}T00:05:00Z`,
    thumbUrl: `https://photos.example/${slot}.webp`,
    ...extra,
  };
}

// The seed's jar 3 days ago: four moments (the evening one Added later) and a removed afternoon one.
const SEED_MOMENTS = [
  moment('whereami'),
  moment('morning'),
  moment('ootd'),
  moment('evening', { is_backfilled: true }),
  moment('afternoon', { status: 'removed' }),
];

function tilesFor(moments: ServerMoment[], queue: QueuedMoment[] = []) {
  return buildTodayGrid({ localDate: DATE, moments, queue, nowSlot: null });
}

async function renderCard(
  props: { moments?: ServerMoment[]; queue?: QueuedMoment[]; isPast?: boolean; onViewJar?: () => void } = {},
) {
  const onFill = jest.fn();
  await render(
    <SelectedDayCard
      date={DATE}
      tiles={tilesFor(props.moments ?? SEED_MOMENTS, props.queue)}
      isPast={props.isPast ?? true}
      onFill={onFill}
      onViewJar={props.onViewJar}
      locale="en-US"
    />,
  );
  return onFill;
}

describe('SelectedDayCard', () => {
  it('shows the date, the count and the day’s moments as thumbnails in slot order', async () => {
    await renderCard();
    expect(screen.getByRole('header', { name: 'Saturday, Nov 7' })).toBeTruthy();
    expect(screen.getByTestId('selected-day-count')).toHaveTextContent('4 of 8 moments · 1 added later');
    const thumbs = screen.getAllByTestId(/^selected-day-thumb-/).map((node) => node.props.testID as string);
    expect(thumbs).toEqual([
      'selected-day-thumb-whereami',
      'selected-day-thumb-ootd',
      'selected-day-thumb-morning',
      'selected-day-thumb-evening',
    ]);
    expect(screen.getAllByTestId('selected-day-empty', { includeHiddenElements: true })).toHaveLength(4);
  });

  it('marks a backfilled moment as added later, and only that one', async () => {
    await renderCard();
    expect(screen.getByRole('image', { name: '#evening, added later' })).toBeTruthy();
    expect(screen.getByRole('image', { name: '#morning' })).toBeTruthy();
    expect(screen.queryByRole('image', { name: '#morning, added later' })).toBeNull();
  });

  it('links to the Jar page only when the day has a jar', async () => {
    const onViewJar = jest.fn();
    await renderCard({ onViewJar });
    await fireEvent.press(screen.getByRole('link', { name: 'View jar' }));
    expect(onViewJar).toHaveBeenCalledTimes(1);
    await renderCard();
    expect(screen.queryByRole('link', { name: 'View jar' })).toBeNull();
  });

  it('leaves the Added later count out when nothing was added later', async () => {
    await renderCard({ moments: [moment('whereami')] });
    expect(screen.getByTestId('selected-day-count')).toHaveTextContent('1 of 8 moments');
    expect(screen.queryByText(/added later/)).toBeNull();
  });

  it('lists the missing slots, counting a removed moment as missing', async () => {
    await renderCard();
    expect(screen.getByLabelText('Missing: #mebusywith, #whoamiwith, #selfie, #afternoon')).toBeTruthy();
    expect(screen.getByText('+ #selfie')).toBeTruthy();
    expect(screen.queryByText('+ #morning')).toBeNull();
  });

  it('a queued photo for the day holds its slot at once (offline first)', async () => {
    const queued: QueuedMoment = {
      id: 3,
      slot: 'selfie',
      state: 'queued',
      localDate: DATE,
      photoUri: 'file:///q/3.jpg',
      thumbUri: null,
      capturedAt: null,
      visibility: 'readers',
    };
    await renderCard({ queue: [queued] });
    expect(screen.getByTestId('selected-day-thumb-selfie')).toBeTruthy();
    expect(screen.queryByText('+ #selfie')).toBeNull();
    expect(screen.getByTestId('selected-day-count')).toHaveTextContent('5 of 8 moments · 1 added later');
  });

  it('offers Fill this jar on a past day with gaps, with the Added later note', async () => {
    const onFill = await renderCard();
    expect(screen.getByText('Moments added now show an “Added later” badge.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fill this jar' }));
    expect(onFill).toHaveBeenCalledTimes(1);
  });

  it('a past day without a jar is all gaps and can be filled', async () => {
    await renderCard({ moments: [] });
    expect(screen.getByTestId('selected-day-count')).toHaveTextContent('0 of 8 moments');
    expect(screen.queryAllByTestId(/^selected-day-thumb-/)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Fill this jar' })).toBeTruthy();
  });

  it('has no Fill this jar for a full past jar', async () => {
    const all: Slot[] = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'];
    await renderCard({ moments: all.map((slot) => moment(slot)) });
    expect(screen.queryByRole('button', { name: 'Fill this jar' })).toBeNull();
    expect(screen.queryByTestId('selected-day-missing')).toBeNull();
    expect(screen.queryByText(/Added later” badge/)).toBeNull();
  });

  it('has no Fill this jar for today, even with gaps', async () => {
    await renderCard({ isPast: false });
    expect(screen.queryByRole('button', { name: 'Fill this jar' })).toBeNull();
    expect(screen.getByText('+ #selfie')).toBeTruthy();
  });
});
