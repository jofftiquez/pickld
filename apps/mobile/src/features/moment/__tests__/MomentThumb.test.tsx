import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import { parseEdits } from '@/features/edit/edits';

import { MomentThumb } from '../MomentThumb';

const hidden = { includeHiddenElements: true } as const;
const edits = parseEdits({
  v: 1,
  filter: 'merienda',
  overlays: [
    {
      id: 's1',
      type: 'sticker',
      stickerId: '4fec3a86-8a82-4601-fe12-fdbf36bead43',
      asset: 'stickers/everyday/kape-muna.png',
      label: 'Kape muna',
      x: 0.3,
      y: 0.3,
      scale: 0.4,
      rotation: 0,
    },
  ],
});

describe('MomentThumb (D-96)', () => {
  it('draws an edited moment with its stickers and filter, not the plain thumbnail', async () => {
    await render(
      <View>
        <MomentThumb uri="https://photos.test/m1.webp" edits={edits} testID="thumb" />
      </View>,
    );
    expect(screen.queryByTestId('thumb-plain', hidden)).toBeNull();
    await fireEvent(screen.getByTestId('thumb', hidden), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 120, height: 160 } },
    });
    const thumb = within(screen.getByTestId('thumb', hidden));
    expect(thumb.getByTestId('moment-overlay-s1', hidden)).toBeTruthy();
    expect(thumb.getByTestId('skia-image', hidden).props.accessibilityHint).toBe('https://photos.test/m1.webp');
  });

  it('falls back to the plain thumbnail without edits or with plain edits', async () => {
    await render(
      <View>
        <MomentThumb uri="https://photos.test/a.webp" testID="a" />
        <MomentThumb uri="https://photos.test/b.webp" edits={parseEdits({})} testID="b" />
      </View>,
    );
    expect(screen.getByTestId('a-plain', hidden).props.source).toEqual([{ uri: 'https://photos.test/a.webp' }]);
    expect(screen.getByTestId('b-plain', hidden)).toBeTruthy();
    expect(screen.queryByTestId('moment-overlay-s1', hidden)).toBeNull();
  });

  it('draws nothing without a photo', async () => {
    await render(
      <View testID="box">
        <MomentThumb uri={null} edits={edits} testID="thumb" />
      </View>,
    );
    expect(screen.queryByTestId('thumb', hidden)).toBeNull();
  });
});
