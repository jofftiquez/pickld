import { fireEvent, render, screen } from '@testing-library/react-native';

import { PackPreviewView, type PackPreviewViewProps } from '../PackPreviewView';
import { buildPacks } from '../shop';
import { shopPackRows, shopStickerRows } from './shopRows';

// Pack preview (FR-STK-07; design: PackPreview): what it says for a pack on sale, an owned pack, and a pack the
// store can't price.

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const NOV = new Date('2026-11-12T03:00:00Z');
const pack = (slug: string) => buildPacks(shopPackRows(), shopStickerRows(), NOV).find((p) => p.slug === slug)!;

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
  it('sells a pack on sale at the store price, previewed on the photo', async () => {
    const props = await setup({ price: '₱49', photoUrl: 'https://photos.test/me.jpg' });
    expect(screen.getByText('Pinoy Life')).toBeTruthy();
    expect(screen.getByText('Preview on your photo')).toBeTruthy();
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
});
