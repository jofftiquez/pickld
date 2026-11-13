import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import StickerShopRedirect from '../../../../app/stickers/shop';
import MyStickersRedirect from '../../../../app/stickers/mine';
import StickersScreen from '../../../../app/stickers/index';
import { stickersTabFrom } from '../stickersTab';

// /stickers (D-61): `?tab=` picks Mine or Shop, and the old /stickers/mine and /stickers/shop links land on
// the matching tab. The page itself is replaced by a stub that names the tab it opened on.

jest.mock('@/features/stickers/StickersHome', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    StickersHome: ({ initialTab }: { initialTab: string }) => <MockText>{`Stickers on ${initialTab}`}</MockText>,
  };
});

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  'stickers/index': StickersScreen,
  'stickers/mine': MyStickersRedirect,
  'stickers/shop': StickerShopRedirect,
};

describe('/stickers', () => {
  it.each([
    ['/stickers', 'mine'],
    ['/stickers?tab=shop', 'shop'],
    ['/stickers?tab=mine', 'mine'],
    ['/stickers?tab=bogus', 'mine'],
    ['/stickers/mine', 'mine'],
    ['/stickers/shop', 'shop'],
  ])('%s opens on %s', async (url, tab) => {
    await renderRouter(routes, { initialUrl: url });
    expect(await screen.findByText(`Stickers on ${tab}`)).toBeTruthy();
  });

  it('reads Mine from a missing or repeated tab', () => {
    expect(stickersTabFrom(undefined)).toBe('mine');
    expect(stickersTabFrom({ tab: ['shop', 'mine'] })).toBe('mine');
  });
});
