import type { StickerOverlayProps } from './stickerRenderer';
import { StickerImage } from './StickerImage';

/** A sticker on the photo, filling the box the transform engine gives it. */
export function StickerOverlay({ overlay, width, height }: StickerOverlayProps) {
  return (
    <StickerImage
      asset={overlay.asset}
      stamp={overlay.stamp}
      width={width}
      height={height}
      testID={`sticker-${overlay.id}`}
    />
  );
}
