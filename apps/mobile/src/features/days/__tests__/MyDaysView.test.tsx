import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { buildMonthGrid, earliestMonth, floorMonth, monthNav, monthsBetween, type MonthJar } from '../monthGrid';
import { MyDaysView, type MyDaysViewProps } from '../MyDaysView';

// The month picker opens in the real kit sheet; gorhom's native sheet is a plain pass-through here.
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet/mock');
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const Sheet = forwardRef<{ close: () => void }, { onClose: () => void; children: ReactNode }>(
    function Sheet(props, ref) {
      useImperativeHandle(ref, () => ({ close: () => props.onClose() }));
      return <>{props.children}</>;
    },
  );
  return {
    ...actual,
    __esModule: true,
    default: Sheet,
    BottomSheetView: ({ children }: { children: ReactNode }) => children,
    BottomSheetScrollView: ({ children }: { children: ReactNode }) => children,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: object) => config,
  };
});

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
      nav={monthNav('2026-11', '2026-11', '2025-11')}
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

  it('enables Next month on a past month and Previous stops at the earliest month', async () => {
    const { onNext, onPrevious } = await renderMyDays({
      grid: buildMonthGrid({ month: '2025-11', today: TODAY }),
      nav: monthNav('2025-11', '2026-11', '2025-11'),
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

  describe('month picker', () => {
    // My days with the range from monthGrid, as app/my-days.tsx passes it.
    async function renderPicker(currentMonth: string, birthday: string | null, firstJarMonth: string | null = null) {
      const onPickMonth = jest.fn();
      const earliest = earliestMonth(floorMonth(birthday), firstJarMonth);
      await renderMyDays({
        grid: buildMonthGrid({ month: currentMonth, today: `${currentMonth}-10` }),
        nav: monthNav(currentMonth, currentMonth, earliest),
        pickableMonths: monthsBetween(earliest, currentMonth),
        onPickMonth,
      });
      return { onPickMonth };
    }
    const chipNames = (prefix: string) =>
      screen
        .getAllByRole('radio')
        .filter((r) => (r.props.testID as string).startsWith(prefix))
        .map((r) => r.props.accessibilityLabel as string);
    const monthNames = () => chipNames('month-picker-2');
    const yearNames = () => chipNames('month-picker-year-');

    it('draws the month as a pill button that says it opens the month picker', async () => {
      await renderPicker('2026-02', null);
      const button = screen.getByRole('button', { name: 'February 2026, 10 moments' });
      expect(button.props.accessibilityHint).toBe('Opens the month picker');
      expect(button.props.testID).toBe('my-days-month');
      expect(screen.getByText('February 2026')).toBeTruthy();
      expect(screen.getByTestId('my-days-subtitle', { includeHiddenElements: true })).toHaveTextContent('10 moments');
      expect(screen.queryByRole('radio')).toBeNull();
    });

    it('opens on the shown year and lists only months in range, back to the birth year', async () => {
      await renderPicker('2026-02', '2024-06-15');
      await fireEvent.press(screen.getByTestId('my-days-month'));
      expect(screen.getByText('Choose a month')).toBeTruthy();
      expect(yearNames()).toEqual(['2026', '2025', '2024']);
      expect(screen.getByRole('radio', { name: '2026' }).props.accessibilityState).toMatchObject({ checked: true });
      // This year stops at the current month: March 2026 can't be chosen.
      expect(monthNames()).toEqual(['January 2026', 'February 2026']);
      expect(screen.queryByTestId('month-picker-2026-03')).toBeNull();
      expect(screen.getByRole('radio', { name: 'February 2026' }).props.accessibilityState).toMatchObject({
        checked: true,
      });
      await fireEvent.press(screen.getByRole('radio', { name: '2024' }));
      expect(monthNames()).toHaveLength(12);
      expect(monthNames()[0]).toBe('January 2024');
      // Before the floor: no 2023 at all.
      expect(screen.queryByRole('radio', { name: '2023' })).toBeNull();
    });

    it('reaches January 2000 while the birthday is unknown', async () => {
      await renderPicker('2026-02', null);
      await fireEvent.press(screen.getByTestId('my-days-month'));
      const years = yearNames();
      expect(years).toHaveLength(27);
      expect(years[years.length - 1]).toBe('2000');
      expect(screen.queryByRole('radio', { name: '1999' })).toBeNull();
    });

    it('goes back to a first jar older than the floor', async () => {
      await renderPicker('2026-02', '2010-03-01', '2008-11');
      await fireEvent.press(screen.getByTestId('my-days-month'));
      await fireEvent.press(screen.getByRole('radio', { name: '2008' }));
      expect(monthNames()).toEqual(['November 2008', 'December 2008']);
    });

    it('jumps to the chosen month and closes', async () => {
      const { onPickMonth } = await renderPicker('2026-02', '2020-01-01');
      await fireEvent.press(screen.getByTestId('my-days-month'));
      await fireEvent.press(screen.getByRole('radio', { name: '2023' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'March 2023' }));
      expect(onPickMonth).toHaveBeenCalledWith('2023-03');
      expect(onPickMonth).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('radio')).toBeNull();
    });
  });

  describe('date picker', () => {
    async function renderDatePicker() {
      const onPickDate = jest.fn();
      const earliest = earliestMonth(floorMonth('2020-04-02'), null);
      await renderMyDays({
        nav: monthNav('2026-11', '2026-11', earliest),
        pickableMonths: monthsBetween(earliest, '2026-11'),
        onPickMonth: jest.fn(),
        onPickDate,
        today: TODAY,
      });
      return { onPickDate };
    }

    it('offers Go to a date, labelled for VoiceOver', async () => {
      await renderDatePicker();
      const button = screen.getByRole('button', { name: 'Go to a date' });
      expect(button.props.accessibilityHint).toBe('Opens the date picker, to add moments to any past day');
    });

    it('goes straight to a day three years back', async () => {
      const { onPickDate } = await renderDatePicker();
      await fireEvent.press(screen.getByRole('button', { name: 'Go to a date' }));
      expect(screen.getByText('Choose a date')).toBeTruthy();
      await fireEvent.press(screen.getByRole('radio', { name: '2023' }));
      // The month is kept across years: November 2023.
      expect(screen.getByRole('radio', { name: 'November 2023' }).props.accessibilityState).toMatchObject({
        checked: true,
      });
      await fireEvent.press(screen.getByRole('radio', { name: 'March 2023' }));
      const day = screen.getByRole('button', { name: 'Thursday, March 9, 2023' });
      expect(day.props.accessibilityHint).toBe('Opens this day to add moments');
      await fireEvent.press(day);
      expect(onPickDate).toHaveBeenCalledWith('2023-03-09');
      expect(screen.queryByText('Choose a date')).toBeNull();
    });

    it('refuses days after today', async () => {
      const { onPickDate } = await renderDatePicker();
      await fireEvent.press(screen.getByRole('button', { name: 'Go to a date' }));
      expect(screen.getByRole('button', { name: 'Monday, November 9, 2026, today' })).toBeTruthy();
      const future = screen.getByTestId('date-picker-day-2026-11-10');
      expect(future.props.accessibilityLabel).toBe('Tuesday, November 10, 2026, not yet');
      expect(future.props.accessibilityState).toMatchObject({ disabled: true });
      expect(screen.queryByRole('button', { name: /November 10, 2026/ })).toBeNull();
      await fireEvent.press(future);
      expect(onPickDate).not.toHaveBeenCalled();
      // Months after this one aren't offered; years before the floor neither.
      expect(screen.queryByTestId('date-picker-2026-12')).toBeNull();
      expect(screen.queryByRole('radio', { name: '2019' })).toBeNull();
    });
  });

  it('keeps the month line plain text without a month picker', async () => {
    await renderMyDays();
    expect(screen.queryByTestId('my-days-month')).toBeNull();
    expect(screen.getByText('November 2026 · 10 moments')).toBeTruthy();
  });
});
