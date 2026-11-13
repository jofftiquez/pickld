import 'react-native-gesture-handler/jestSetup';

import { fireEvent, render, screen } from '@testing-library/react-native';

import type { MyPack } from '../myStickers';
import { StickersHome, type StickersHomeProps } from '../StickersHome';

// The Stickers page (D-61; FR-STK-06, FR-STK-08): Mine | Shop over My stickers and the Sticker shop, fed by
// the same queries as before (replaced here with fixed answers).

const mockMine: MyPack[] = [
  {
    id: 'p1',
    slug: 'everyday',
    name: 'Everyday',
    kind: 'free',
    boughtAt: null,
    stickerCount: 4,
    usableCount: 4,
    sample: null,
    hidden: false,
  },
];

jest.mock('../useMyStickers', () => ({
  useMyPacks: () => ({ data: mockMine, isError: false, refetch: jest.fn() }),
  useSavePacks: () => ({ isError: false, mutate: jest.fn() }),
  useRestorePurchases: () => ({ mutate: jest.fn() }),
}));
jest.mock('../useShop', () => {
  const rows = jest.requireActual<typeof import('./shopRows')>('./shopRows');
  const data = { packs: rows.shopPackRows(), stickers: rows.shopStickerRows(), answers: rows.answers(['barkada']) };
  return {
    useShopRows: () => ({ data, isError: false, refetch: jest.fn() }),
    usePrices: () => new Map<string, string>(),
  };
});

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

async function setup(over: Partial<StickersHomeProps> = {}) {
  const props: StickersHomeProps = { initialTab: 'mine', insets, onClose: jest.fn(), onOpenPack: jest.fn(), ...over };
  await render(<StickersHome {...props} />);
  return props;
}

const selected = (name: string) => screen.getByRole('tab', { name }).props.accessibilityState?.selected as boolean;

describe('StickersHome', () => {
  it('opens on Mine with your packs under one Stickers title', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Stickers' })).toBeTruthy();
    expect(selected('Mine')).toBe(true);
    expect(selected('Shop')).toBe(false);
    expect(screen.getByTestId('my-stickers-row-everyday')).toBeTruthy();
    expect(screen.queryByTestId('sticker-shop')).toBeNull();
  });

  it('switches to Shop, where a pack opens its preview', async () => {
    const props = await setup();
    await fireEvent.press(screen.getByRole('tab', { name: 'Shop' }));
    expect(selected('Shop')).toBe(true);
    expect(screen.queryByTestId('my-stickers')).toBeNull();
    await fireEvent.press(screen.getByTestId('sticker-shop-pack-everyday'));
    expect(props.onOpenPack).toHaveBeenCalledWith(expect.objectContaining({ slug: 'everyday' }));
  });

  it('goes to Shop from Get more stickers, and back to Mine from the switch', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('my-stickers-shop'));
    expect(screen.getByTestId('sticker-shop')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mine' }));
    expect(screen.getByTestId('my-stickers')).toBeTruthy();
  });

  it('opens on Shop when asked, and closes', async () => {
    const props = await setup({ initialTab: 'shop' });
    expect(selected('Shop')).toBe(true);
    expect(screen.getByTestId('sticker-shop')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
