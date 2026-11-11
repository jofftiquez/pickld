import { Image } from 'expo-image';
import { View } from 'react-native';

import { stickerArtFor } from './stickerArt';
import { stampText, useStampMoment, type StampKind } from './stamps';
import { StampSticker } from './StampSticker';

export type StickerImageProps = {
  /** The catalog's asset_path, e.g. "stickers/everyday/kape-muna.png". */
  asset: string;
  stamp?: StampKind | null;
  width: number;
  height: number;
  testID?: string;
};

/**
 * One sticker's picture at a given size: its bundled art, or for an auto stamp the live value of the
 * moment being edited. Decorative: the control or overlay around it carries the spoken name.
 */
export function StickerImage({ asset, stamp, width, height, testID }: StickerImageProps) {
  const moment = useStampMoment();
  const live = stamp && moment ? stampText(stamp, moment) : null;
  if (live !== null) return <StampSticker text={live} width={width} height={height} testID={testID} />;
  const art = stickerArtFor(asset);
  // A sticker this app version has no art for takes its place without drawing (see catalog.ts TODO).
  if (!art) return <View style={{ width, height }} testID={testID} />;
  return (
    <Image source={art.source} style={{ width, height }} contentFit="contain" accessible={false} testID={testID} />
  );
}
