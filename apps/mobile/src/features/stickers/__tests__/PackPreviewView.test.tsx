import { fireEvent, render, screen } from '@testing-library/react-native';

import { PackPreviewView, type PackPreviewViewProps } from '../PackPreviewView';
import { buildPacks } from '../shop';
import { shopPackRows, shopStickerRows } from './shopRows';

// Pack preview (FR-STK-07; design: PackPreview): what it says for a pack on sale, an owned pack, and a pack the
// store can't price; its cover shows the pack's stickers, large, and no photo (D-81).

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const NOV = new Date('2026-11-12T03:00:00Z');
const pack = (slug: string) => buildPacks(shopPackRows(), shopStickerRows(), NOV).find((p) => p.slug === slug)!;
/** The pack with `count` made-up stickers (their art isn't bundled, so each draws as a square box). */
const withStickers = (slug: string, count: number) => {
  const stickers = Array.from({ length: count }, (_, i) => ({ asset: `stickers/test/s${i}.png`, label: `S${i}` }));
  return { ...pack(slug), stickers, labels: stickers.map((s) => s.label), stickerCount: count };
};
/** The width and height a cover sticker draws at. */
const size = (spot: { children: unknown[] }) =>
  (spot.children[0] as { props: { style: { width: number; height: number } } }).props.style;

async function setup(over: Partial<PackPreviewViewProps>) {
  const props: PackPreviewViewProps = {
    pack: pack('pinoy-life'),
    insets,
    onBack: jest.fn(),
    onRetry: jest.fn(),
    onBuy: jest.fn(),
    onShare: jest.fn(),
    ...over,
  };
  await render(<PackPreviewView {...props} />);
  return props;
}

describe('PackPreviewView', () => {
  it('sells a pack on sale at the store price', async () => {
    const props = await setup({ price: '₱49' });
    expect(screen.getByText('Pinoy Life')).toBeTruthy();
    expect(screen.getByText('Yours to keep. Friends see your stickers for free.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Get Pinoy Life · ₱49'));
    expect(props.onBuy).toHaveBeenCalledTimes(1);
  });

  it('offers nothing to buy without a store price, or for a pack the user has', async () => {
    await setup({});
    expect(screen.queryByTestId('pack-preview-buy')).toBeNull();
    expect(screen.getByText('This pack isn’t for sale right now.')).toBeTruthy();
    await setup({ pack: pack('everyday'), price: '₱49' });
    expect(screen.queryByTestId('pack-preview-buy')).toBeNull();
    expect(screen.getByText('You have this pack. Find it in the Stickers tool.')).toBeTruthy();
  });

  it('shows a failed purchase under the button and disables it while buying', async () => {
    await setup({ price: '₱49', buyFailed: true });
    expect(screen.getByText('That didn’t go through. Try again in a moment.')).toBeTruthy();
    await setup({ price: '₱49', buying: true });
    expect(screen.getByTestId('pack-preview-buy')).toBeDisabled();
  });

  it("covers the page with the pack's stickers, large, and no photo", async () => {
    await setup({ pack: withStickers('pinoy-life', 9), price: '₱49' });
    expect(screen.queryByTestId('pack-preview-photo')).toBeNull();
    expect(screen.queryByText('Preview on your photo')).toBeNull();
    const spots = screen.getAllByTestId('pack-preview-cover-sticker');
    expect(spots).toHaveLength(5);
    // Over twice a card sticker's 44 points, so the cover reads as a big cluster.
    expect(spots.every((spot) => size(spot).height >= 84)).toBe(true);
    // The title, price and button stay as they were.
    expect(screen.getByText('Pinoy Life')).toBeTruthy();
    expect(screen.getByText('Get Pinoy Life · ₱49')).toBeTruthy();
  });

  it('fills the cover for small packs, bigger as the pack gets smaller', async () => {
    await setup({ pack: withStickers('pinoy-life', 1) });
    const one = screen.getAllByTestId('pack-preview-cover-sticker');
    expect(one).toHaveLength(1);
    expect(size(one[0]!).height).toBe(140);
    await setup({ pack: withStickers('pinoy-life', 3) });
    const three = screen.getAllByTestId('pack-preview-cover-sticker');
    expect(three).toHaveLength(3);
    expect(size(three[0]!).height).toBe(96);
  });
});
