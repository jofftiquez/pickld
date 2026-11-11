import { render, screen } from '@testing-library/react-native';

import GalleryRoute from '../../../app/dev/gallery';
import DevSignInRoute from '../../../app/dev/sign-in';

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText> };
});
jest.mock('@/dev/DevSignIn', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DevSignIn: () => <MockText>dev-sign-in</MockText> };
});
jest.mock('@/dev/Gallery', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Gallery: () => <MockText>gallery</MockText> };
});

const g = globalThis as unknown as { __DEV__: boolean };

describe('/dev/gallery', () => {
  const dev = g.__DEV__;
  afterEach(() => {
    g.__DEV__ = dev;
  });

  it('shows the gallery in dev builds', async () => {
    g.__DEV__ = true;
    await render(<GalleryRoute />);
    expect(screen.getByText('gallery')).toBeTruthy();
  });

  it('redirects home in release builds', async () => {
    g.__DEV__ = false;
    await render(<GalleryRoute />);
    expect(screen.getByText('redirect:/')).toBeTruthy();
    expect(screen.queryByText('gallery')).toBeNull();
  });

  it('keeps /dev/sign-in out of release builds', async () => {
    g.__DEV__ = false;
    await render(<DevSignInRoute />);
    expect(screen.getByText('redirect:/')).toBeTruthy();
    expect(screen.queryByText('dev-sign-in')).toBeNull();
  });
});
