import { render, screen } from '@testing-library/react-native';

import ShareMatrixRoute from '../../../app/dev/share-matrix';

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText> };
});
jest.mock('@/dev/ShareMatrix', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { ShareMatrix: () => <MockText>share-matrix</MockText> };
});

const g = globalThis as unknown as { __DEV__: boolean };

describe('/dev/share-matrix', () => {
  const dev = g.__DEV__;
  afterEach(() => {
    g.__DEV__ = dev;
  });

  it('shows the render matrix in dev builds', async () => {
    g.__DEV__ = true;
    await render(<ShareMatrixRoute />);
    expect(screen.getByText('share-matrix')).toBeTruthy();
  });

  it('redirects home in release builds', async () => {
    g.__DEV__ = false;
    await render(<ShareMatrixRoute />);
    expect(screen.getByText('redirect:/')).toBeTruthy();
    expect(screen.queryByText('share-matrix')).toBeNull();
  });
});
