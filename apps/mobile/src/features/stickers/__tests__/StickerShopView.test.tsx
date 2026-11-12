import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { buildShop } from '../shop';
import { StickerShopView, type StickerShopViewProps } from '../StickerShopView';
import { answers, shopPackRows, shopStickerRows } from './shopRows';

// The Sticker shop screen (FR-STK-06; design: StickerShop) on the arrangement buildShop makes.

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const NOV = new Date('2026-11-12T03:00:00Z');
const prices = new Map([
  ['me.pickld.pack.christmas_2026', '₱49'],
  ['me.pickld.pack.pinoy_life', '₱49'],
  ['me.pickld.pack.barkada', '₱49'],
  // Work From Wherever: the store doesn't know it (yet), so no price shows.
  ['me.pickld.pack.pet_parent', '₱99'],
]);

async function setup(over: Partial<StickerShopViewProps> = {}) {
  const props: StickerShopViewProps = {
    shop: buildShop(shopPackRows(), shopStickerRows(), answers(['barkada'], ['work']), NOV),
    prices,
    query: '',
    onQuery: jest.fn(),
    insets,
    onClose: jest.fn(),
    onOpenPack: jest.fn(),
    onRetry: jest.fn(),
    locale: 'en-US',
    ...over,
  };
  await render(<StickerShopView {...props} />);
  return props;
}

describe('StickerShopView', () => {
  it('shows the seasonal banner with its price and last day on sale, and opens its preview', async () => {
    const props = await setup();
    const banner = screen.getByTestId('sticker-shop-seasonal-christmas-2026');
    expect(within(banner).getByText('Christmas pack')).toBeTruthy();
    // On sale until the first instant of Jan 1 in Manila, so the last day is Dec 31.
    expect(within(banner).getByText('Limited · until Dec 31')).toBeTruthy();
    expect(within(banner).getByText('Simbang Gabi, Noche Buena, aguinaldo')).toBeTruthy();
    expect(within(banner).getByText('₱49')).toBeTruthy();
    await fireEvent.press(banner);
    expect(props.onOpenPack).toHaveBeenCalledWith(expect.objectContaining({ slug: 'christmas-2026' }));
  });

  it('lists "For you" best match first with the answers behind it and store prices', async () => {
    const props = await setup();
    expect(screen.getByText('Because you picked Barkada and Work')).toBeTruthy();
    const row = within(screen.getByTestId('sticker-shop-for-you'));
    expect(row.getAllByRole('button').map((b) => b.props.accessibilityLabel as string)).toEqual([
      'Barkada, 2 stickers, ₱49',
      'Work From Wherever, 2 stickers',
      'Pinoy Life, 2 stickers, ₱49',
      'Pet Parent, 1 sticker, ₱99',
    ]);
    expect(within(screen.getByTestId('sticker-shop-pack-pet-parent')).getByText('1 sticker')).toBeTruthy();
    await fireEvent.press(row.getByLabelText('Barkada, 2 stickers, ₱49'));
    expect(props.onOpenPack).toHaveBeenCalledWith(expect.objectContaining({ slug: 'barkada' }));
  });

  it('marks owned packs Owned and earned packs Earned under "Yours"', async () => {
    await setup();
    expect(within(screen.getByTestId('sticker-shop-pack-everyday')).getByText('Owned')).toBeTruthy();
    expect(within(screen.getByTestId('sticker-shop-pack-milestones')).getByText('Earned')).toBeTruthy();
  });

  it('passes typing to the search and says when nothing matches', async () => {
    const props = await setup();
    await fireEvent.changeText(screen.getByLabelText('Search sticker packs'), 'noche');
    expect(props.onQuery).toHaveBeenCalledWith('noche');

    await setup({
      query: 'zzz ',
      shop: buildShop(shopPackRows(), shopStickerRows(), null, NOV, 'zzz '),
    });
    expect(screen.getByText('No packs match “zzz”.')).toBeTruthy();
  });

  it('offers a retry when the packs could not load', async () => {
    const props = await setup({ shop: undefined, failed: true });
    await fireEvent.press(screen.getByText('Try again'));
    expect(props.onRetry).toHaveBeenCalled();
  });
});
