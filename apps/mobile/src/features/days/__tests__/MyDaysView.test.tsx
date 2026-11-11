import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildMonthGrid, monthNav, type MonthJar } from '../monthGrid';
import { MyDaysView, type MyDaysViewProps } from '../MyDaysView';

const TODAY = '2026-11-09';

function jar(localDate: string, count: number, coverUrl: string | null): MonthJar {
  return {
    jar_id: `j-${localDate}`,
    local_date: localDate,
    tz: 'Asia/Manila',
    moment_count: count,
    is_full: count === 8,
    cover_moment_id: coverUrl ? `m-${localDate}` : null,
    cover_thumb_path: coverUrl ? `thumbs/${localDate}.webp` : null,
    coverUrl,
  };
}

const JARS = [
  jar('2026-11-06', 3, 'https://photos.example/6.webp'),
  // An empty jar (no cover) and a jar whose cover URL couldn't be signed (offline or fn failure).
  jar('2026-11-07', 0, null),
  { ...jar('2026-11-08', 5, null), cover_moment_id: 'm-8', cover_thumb_path: 'thumbs/8.webp' },
  jar('2026-11-09', 2, 'https://photos.example/9.webp'),
];

async function renderMyDays(props: Partial<MyDaysViewProps> = {}) {
  const handlers = { onPrevious: jest.fn(), onNext: jest.fn(), onSelectDay: jest.fn() };
  await render(
    <MyDaysView
      grid={buildMonthGrid({ month: '2026-11', today: TODAY, jars: JARS })}
      momentCount={10}
      nav={monthNav('2026-11', '2026-11', '2026-09')}
      selectedDate={null}
      insets={{ top: 47, bottom: 34 }}
      locale="en-US"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('MyDaysView', () => {
  it('shows the title, month and moment count', async () => {
    await renderMyDays();
    expect(screen.getByTestId('screen-title').props.children).toBe('My days');
    expect(screen.getByText('November 2026 · 10 moments')).toBeTruthy();
  });

  it('announces Next month as disabled on the current month, and does not call it', async () => {
    const { onNext } = await renderMyDays();
    const next = screen.getByRole('button', { name: 'Next month' });
    expect(next.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(next);
    expect(onNext).not.toHaveBeenCalled();
    const previous = screen.getByRole('button', { name: 'Previous month' });
    expect(previous.props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('enables Next month on a past month and Previous stops at the first-jar month', async () => {
    const { onNext, onPrevious } = await renderMyDays({
      grid: buildMonthGrid({ month: '2026-09', today: TODAY }),
      nav: monthNav('2026-09', '2026-11', '2026-09'),
    });
    const next = screen.getByRole('button', { name: 'Next month' });
    expect(next.props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    const previous = screen.getByRole('button', { name: 'Previous month' });
    expect(previous.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(previous);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it('labels days with their moment count, today, and future days as not yet (disabled)', async () => {
    const { onSelectDay } = await renderMyDays();
    expect(screen.getByRole('button', { name: 'November 6, 3 of 8 moments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'November 1, 0 of 8 moments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'November 9, today, 2 of 8 moments' })).toBeTruthy();
    const future = screen.getByRole('button', { name: 'November 10, not yet' });
    expect(future.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(future);
    expect(onSelectDay).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('day-2026-11-06'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-11-06');
  });

  it('draws covers only where there is a URL and fill bars only for jars with moments', async () => {
    await renderMyDays();
    // Covers: the 6th and the 9th. The empty jar and the unsigned cover show no photo.
    expect(screen.getAllByTestId('day-cover')).toHaveLength(2);
    expect(screen.getByTestId('day-2026-11-07')).toBeTruthy();
    // Fill bars: 6th, 8th (no photo but 5 moments) and 9th.
    expect(screen.getAllByTestId('day-fill')).toHaveLength(3);
  });

  it('draws weekday letters in the grid order, hidden from screen readers', async () => {
    await renderMyDays({ grid: buildMonthGrid({ month: '2026-11', today: TODAY, weekStart: 1 }) });
    expect(screen.queryByText('M')).toBeNull();
    const letters = screen
      .getAllByText(/^[SMTWF]$/, { includeHiddenElements: true })
      .map((n) => n.props.children as string);
    expect(letters).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
});
