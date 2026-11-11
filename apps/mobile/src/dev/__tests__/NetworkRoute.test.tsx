import { render, screen } from '@testing-library/react-native';

import DevNetworkRoute from '../../../app/dev/network';

const mockParams: { current: Record<string, string | undefined> } = { current: {} };
jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
    useLocalSearchParams: () => mockParams.current,
  };
});
const mockSetDevOffline = jest.fn(async (_next: boolean) => undefined);
jest.mock('@/lib/devOffline', () => ({
  ...jest.requireActual('@/lib/devOffline'),
  setDevOffline: (next: boolean) => mockSetDevOffline(next),
}));

const g = globalThis as unknown as { __DEV__: boolean };

describe('/dev/network', () => {
  const dev = g.__DEV__;
  afterEach(() => {
    g.__DEV__ = dev;
    mockSetDevOffline.mockClear();
  });

  it.each([
    ['1', true],
    ['0', false],
  ])('offline=%s sets the switch to %p in dev builds, then goes home', async (offline, expected) => {
    g.__DEV__ = true;
    mockParams.current = { offline };
    await render(<DevNetworkRoute />);
    expect(await screen.findByText('redirect:/')).toBeTruthy();
    expect(mockSetDevOffline.mock.calls).toEqual([[expected]]);
  });

  it('ignores an unknown value', async () => {
    g.__DEV__ = true;
    mockParams.current = { offline: 'yes' };
    await render(<DevNetworkRoute />);
    expect(screen.getByText('redirect:/')).toBeTruthy();
    expect(mockSetDevOffline).not.toHaveBeenCalled();
  });

  it('changes nothing in release builds', async () => {
    g.__DEV__ = false;
    mockParams.current = { offline: '1' };
    await render(<DevNetworkRoute />);
    expect(screen.getByText('redirect:/')).toBeTruthy();
    expect(mockSetDevOffline).not.toHaveBeenCalled();
  });
});
