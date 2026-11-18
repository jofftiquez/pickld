import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

import { useStickerArtSource } from './remoteStickerArt';
import { stampText, useStampMoment, type StampKind } from './stamps';
import { StampSticker } from './StampSticker';

export type StickerImageProps = {
  /** The catalog's asset_path, e.g. "stickers/everyday/kape-muna.png". */
  asset: string;
  stamp?: StampKind | null;
  width: number;
  height: number;
  /**
   * Decode the art at its own size instead of the view's. A sticker on a photo is pinched bigger than it was laid
   * out (OverlayItem scales it until the gesture ends), so art decoded at the smaller size would blur.
   */
  fullResolution?: boolean;
  testID?: string;
};

/**
 * One sticker's picture at a given size: its bundled art, its art downloaded from the photo Worker (D-131;
 * a soft placeholder until it arrives, nothing when the Worker has no such art), or for an auto stamp the
 * live value of the moment being edited. Decorative: the control or overlay around it carries the spoken name.
 */
export function StickerImage({ asset, stamp, width, height, fullResolution = false, testID }: StickerImageProps) {
  const { t } = useTranslation();
  const moment = useStampMoment();
  const art = useStickerArtSource(asset);
  const jarNumber = moment?.jarNumber ?? null;
  const live =
    stamp === 'jar_number' && jarNumber !== null
      ? t('momentRenderer.jarStamp', { number: jarNumber })
      : stamp && moment
        ? stampText(stamp, moment)
        : null;
  if (live !== null) return <StampSticker text={live} width={width} height={height} testID={testID} />;
  if (art.kind === 'missing') return <View style={{ width, height }} testID={testID} />;
  if (art.kind === 'loading') {
    return (
      <View
        style={{ width, height, borderRadius: radius.thumb, backgroundColor: colors.tileIconWell }}
        testID={testID}
      />
    );
  }
  return (
    <Image
      source={art.kind === 'bundled' ? art.source : { uri: art.uri }}
      style={{ width, height }}
      contentFit="contain"
      allowDownscaling={!fullResolution}
      accessible={false}
      testID={testID}
    />
  );
}
