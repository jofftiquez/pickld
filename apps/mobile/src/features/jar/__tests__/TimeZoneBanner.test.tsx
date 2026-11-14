import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { colors } from '@/theme/tokens';

import { TimeZoneBanner } from '../TimeZoneBanner';
import type { BannerJar } from '../timeZoneBannerLogic';
import { useTimeZoneBanner } from '../useTimeZoneBanner';

const mockDisk = new Map<string, string>();
// A read waits for `mockGate.current` when set, to hold the store mid-load.
const mockGate: { current: Promise<void> | null } = { current: null };
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => {
      if (mockGate.current) await mockGate.current;
      return mockDisk.get(k) ?? null;
    },
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));

beforeEach(() => {
  mockDisk.clear();
  mockGate.current = null;
});

describe('TimeZoneBanner', () => {
  it('names both zones and Got it calls onDismiss', async () => {
    const onDismiss = jest.fn();
    await render(<TimeZoneBanner from="Manila" to="Tokyo" onDismiss={onDismiss} />);
    expect(screen.getByText('You’re in Tokyo time')).toBeTruthy();
    expect(screen.getByText('Your last jar was on Manila time. Today’s jar follows Tokyo time.')).toBeTruthy();
    expect(
      screen.getByLabelText('You’re in Tokyo time Your last jar was on Manila time. Today’s jar follows Tokyo time.'),
    ).toBeTruthy();
    expect(screen.getByTestId('timezone-banner')).toHaveStyle({ backgroundColor: colors.surface });

    const gotIt = screen.getByRole('button', { name: 'Got it' });
    expect(gotIt.props.accessibilityHint).toBe('Hides this message');
    await fireEvent.press(gotIt);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

const USER = 'user-1';
const tokyo: BannerJar = { id: 'jar-tokyo', tz: 'Asia/Tokyo', localDate: '2026-11-10' };

function Harness({ userId = USER, jar = tokyo }: { userId?: string; jar?: BannerJar }) {
  const zone = useTimeZoneBanner({ userId, jar, previousTz: 'Asia/Manila' });
  return zone.show && zone.zones ? (
    <TimeZoneBanner from={zone.zones.from} to={zone.zones.to} onDismiss={zone.acknowledge} />
  ) : null;
}

describe('useTimeZoneBanner', () => {
  it('Got it hides the banner and records the jar for this user, so it stays hidden after a restart', async () => {
    const first = await render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('timezone-banner')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
    await waitFor(() => expect(mockDisk.get(`pickld-tz-banner-acks:${USER}`)).toBe('["jar-tokyo"]'));
    await first.unmount();

    await render(<Harness />);
    // Give the stored acknowledgements time to load; the banner must not come back.
    await waitFor(() => expect(mockDisk.size).toBe(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
  });

  it('acknowledgements are per user and per jar', async () => {
    mockDisk.set(`pickld-tz-banner-acks:${USER}`, '["jar-tokyo"]');
    const other = await render(<Harness userId="user-2" />);
    await waitFor(() => expect(screen.getByTestId('timezone-banner')).toBeTruthy());
    await other.unmount();

    await render(<Harness jar={{ id: 'jar-seoul', tz: 'Asia/Seoul', localDate: '2026-11-12' }} />);
    await waitFor(() => expect(screen.getByText('You’re in Seoul time')).toBeTruthy());
  });

  it('stays hidden while the acknowledgements are still loading, so an acknowledged jar never flashes it', async () => {
    mockDisk.set(`pickld-tz-banner-acks:${USER}`, '["jar-tokyo"]');
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockGate.current = gate;
    await render(<Harness />);
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
  });

  it('a corrupt stored value counts as nothing acknowledged', async () => {
    mockDisk.set(`pickld-tz-banner-acks:${USER}`, '{"not":"a list"}');
    await render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('timezone-banner')).toBeTruthy());
  });
});
